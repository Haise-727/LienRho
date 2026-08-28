/**
 * POST /api/match — clear one financing opportunity.
 *
 * Two callers, two shapes, deliberately both supported:
 *
 *   Track 4 (UI)      { opportunityId, urgencyNudgeBps? }
 *                     Bids are read from the database.
 *
 *   Track 3 (agents)  { opportunity_id, bids: LenderBid[] }
 *                     Bids are supplied inline by LenderBiddingAgent and scored
 *                     without being persisted first.
 *
 * Supporting both is not indecision. The UI's bids are already in Postgres and
 * re-posting them would invite the screen and the database to disagree; the
 * agents' bids are generated in-process and may never be persisted at all.
 * Forcing either through the other's path would mean a write the caller did not
 * ask for.
 *
 * The scoring itself is identical either way — both paths converge on
 * `scoreOffers`, so there is exactly one implementation of the ranking.
 */

import { prisma } from '@/lib/db';
import { fail } from '@/lib/serialize';

import { clearOpportunity } from '@/lib/market/clear';
import { lenderBidProviderNames, lenderBidToOffer } from '@/lib/market/agent-adapter';
import type { LenderBidPayload } from '@/lib/market/agent-adapter';
import { decimalToPaise, toIsoDate } from '@/lib/market/prisma-adapter';
import { scoreOffers } from '@/lib/market/score';
import { supplierUtilityFromStored } from '@/lib/market/utility';
import type { MatchResult } from '@/lib/market/types';

export const dynamic = 'force-dynamic';

interface MatchBody {
  opportunityId?: string;
  opportunity_id?: string;
  urgencyNudgeBps?: number;
  bids?: LenderBidPayload[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MatchBody;

    // Accept either casing. Track 3 posts snake_case from Python; the UI posts
    // camelCase. Rejecting one of them over a naming convention would be a
    // pointless integration failure.
    const opportunityId = body.opportunityId ?? body.opportunity_id;
    if (!opportunityId) {
      return fail('opportunityId is required', 400);
    }

    const urgencyNudgeBps = clampNudge(body.urgencyNudgeBps);
    const asOf = new Date().toISOString().slice(0, 10);

    const opportunity = await prisma.financingOpportunity.findUnique({
      where: { id: opportunityId },
      include: {
        invoice: { select: { faceValue: true } },
        // Without this join the gates fall back to the stored columns, which
        // Track 1 leaves null by design — and clearing silently degrades to
        // cost-only ranking.
        cashPosition: { include: { obligations: { orderBy: { dueDate: 'asc' } } } },
      },
    });
    if (!opportunity) return fail(`No opportunity ${opportunityId}`, 404);

    const result = body.bids?.length
      ? scoreAgentBids({ body, opportunity, opportunityId, asOf, urgencyNudgeBps })
      : await scoreStoredBids({ opportunity, opportunityId, asOf, urgencyNudgeBps });

    return Response.json(withLegacyFields(result));
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to clear opportunity');
  }
}

/** Bids posted inline by Track 3's agents. Nothing is persisted. */
function scoreAgentBids({
  body,
  opportunity,
  opportunityId,
  asOf,
  urgencyNudgeBps,
}: {
  body: MatchBody;
  opportunity: { invoice: { faceValue: unknown }; sufficiencyFloor: unknown; timingDeadline: Date | null };
  opportunityId: string;
  asOf: string;
  urgencyNudgeBps: number;
}): MatchResult {
  const bids = body.bids ?? [];

  const utility = supplierUtilityFromStored(
    opportunity.sufficiencyFloor === null
      ? null
      : decimalToPaise(opportunity.sufficiencyFloor as string),
    opportunity.timingDeadline === null ? null : toIsoDate(opportunity.timingDeadline),
    asOf,
  );

  const { scoredOffers, survivors } = scoreOffers({
    offers: bids.map((b) => lenderBidToOffer(b, opportunityId)),
    opportunity: { faceValuePaise: decimalToPaise(opportunity.invoice.faceValue as string) },
    utility,
    providerNames: lenderBidProviderNames(bids),
    asOf,
    urgencyNudgeBps,
  });

  if (survivors.length === 0) {
    return {
      status: 'NO_ACCEPTABLE_OFFER',
      opportunityId,
      scoredOffers,
      utility,
      reason: 'No agent bid cleared the supplier gates',
    };
  }

  const winner = survivors[0];
  return {
    status: 'MATCHED',
    opportunityId,
    allocations: [
      {
        offerId: winner.offer.id,
        providerId: winner.offer.providerId,
        providerName: winner.providerName,
        fundedPaise: winner.advancePaise,
        providerLiquidityAfterPaise: -1,
      },
    ],
    scoredOffers,
    utility,
  };
}

/** Bids already in Postgres — the path the UI uses. */
async function scoreStoredBids({
  opportunity,
  opportunityId,
  asOf,
  urgencyNudgeBps,
}: {
  opportunity: {
    invoice: { faceValue: unknown };
    sufficiencyFloor: unknown;
    timingDeadline: Date | null;
    cashPosition: {
      currentCashPaise: number;
      cashThresholdPaise: number;
      obligations: { label: string; amountPaise: number; dueDate: Date }[];
    } | null;
  };
  opportunityId: string;
  asOf: string;
  urgencyNudgeBps: number;
}): Promise<MatchResult> {
  const bids = await prisma.bid.findMany({
    where: { opportunityId, status: 'ACTIVE' },
    include: { provider: { select: { id: true, name: true } } },
  });

  return clearOpportunity({
    opportunity: {
      id: opportunityId,
      invoice: { faceValue: opportunity.invoice.faceValue as string },
      sufficiencyFloor: opportunity.sufficiencyFloor as string | null,
      timingDeadline: opportunity.timingDeadline,
      // Dates become YYYY-MM-DD here because Track 2's types use IsoDate
      // strings — they survive JSON intact, where a Date does not.
      cashPosition: opportunity.cashPosition
        ? {
            currentCashPaise: opportunity.cashPosition.currentCashPaise,
            cashThresholdPaise: opportunity.cashPosition.cashThresholdPaise,
            obligations: opportunity.cashPosition.obligations.map((o) => ({
              label: o.label,
              amountPaise: o.amountPaise,
              dueDate: o.dueDate.toISOString().slice(0, 10),
            })),
          }
        : null,
    },
    // Prisma Decimals stringify correctly for the adapter, which parses decimal
    // text rather than going through Number().
    bids: bids.map((b) => ({
      id: b.id,
      opportunityId: b.opportunityId,
      providerId: b.providerId,
      advanceRate: b.advanceRate.toString(),
      annualRate: b.annualRate.toString(),
      flatFee: b.flatFee.toString(),
      tenorDays: b.tenorDays,
      settlementDays: b.settlementDays,
      recourse: b.recourse,
      expiresAt: b.expiresAt,
      provider: b.provider,
    })),
    asOf,
    urgencyNudgeBps,
  });
}

/** 0..10000. Out-of-range values are clamped rather than rejected. */
function clampNudge(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

/**
 * Compatibility shim for Track 3's placeholder `MatchResult` mapping.
 *
 * `HttpMatchingClient` currently reads `matched` / `matchedBidRef` / `score` /
 * `matchId` and defaults `matched` to false when absent — which would report
 * "no match" for every successful match against the real union. Emitting these
 * alongside the real fields means their integration works today without them
 * changing code mid-sprint.
 *
 * **This is a shim, not the contract.** `status` is the real signal, and it
 * distinguishes NO_ACCEPTABLE_OFFER (a legitimate market outcome) from an
 * error — a distinction `matched: false` cannot express. Track 3 should migrate
 * to reading `status` and these fields should then be deleted. Tracked in
 * issue #9 item 4.
 */
function withLegacyFields(result: MatchResult) {
  const winner = result.status === 'MATCHED' ? result.allocations[0] : null;

  return {
    ...result,
    matchId: `match-${result.opportunityId}`,
    matched: result.status === 'MATCHED',
    matchedBidRef: winner?.providerId ?? null,
    // Track 3's `score` is 0..1 higher-is-better; effective cost is bps
    // lower-is-better. Inverted here so their notion of "good" is preserved
    // rather than silently reversed.
    score:
      result.status === 'MATCHED'
        ? Number((1 / (1 + result.scoredOffers[0].effectiveCostBps / 10_000)).toFixed(4))
        : 0,
    notes:
      result.status === 'MATCHED'
        ? `Selected ${winner?.providerName} on effective cost after sufficiency and timing gates.`
        : result.reason,
    simulated: true,
  };
}
