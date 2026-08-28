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
 * The scoring is identical either way — both paths converge on `scoreOffers`,
 * and both derive the supplier's gates through `utilityFor`, so there is one
 * ranking implementation and one gate derivation.
 */

import { fail } from '@/lib/serialize';

import { lenderBidProviderNames, lenderBidToOffer } from '@/lib/market/agent-adapter';
import type { LenderBidPayload } from '@/lib/market/agent-adapter';
import { scoreOffers } from '@/lib/market/score';
import { analyseFrontier, degeneracyWarning } from '@/lib/market/pareto';
import {
  clearById,
  faceValuePaiseFor,
  loadOpportunity,
  today,
  utilityFor,
} from '@/lib/market/server';
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
    if (!opportunityId) return fail('opportunityId is required', 400);

    const urgencyNudgeBps = clampNudge(body.urgencyNudgeBps);
    const asOf = today();

    let result: MatchResult;

    if (body.bids?.length) {
      const opportunity = await loadOpportunity(opportunityId);
      if (!opportunity) return fail(`No opportunity ${opportunityId}`, 404);
      result = scoreAgentBids({
        bids: body.bids,
        opportunityId,
        // Same derivation the stored path uses. Reading the stored columns here
        // instead would return `unconstrained` — they are null by design — and
        // every agent bid would be scored with no gates at all.
        utility: utilityFor(opportunity, asOf),
        faceValuePaise: faceValuePaiseFor(opportunity),
        asOf,
        urgencyNudgeBps,
      });
    } else {
      const cleared = await clearById(opportunityId, urgencyNudgeBps, asOf);
      if (!cleared) return fail(`No opportunity ${opportunityId}`, 404);
      result = cleared;
    }

    return Response.json(withLegacyFields(result));
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to clear opportunity');
  }
}

/** Bids posted inline by Track 3's agents. Nothing is persisted. */
function scoreAgentBids({
  bids,
  opportunityId,
  utility,
  faceValuePaise,
  asOf,
  urgencyNudgeBps,
}: {
  bids: LenderBidPayload[];
  opportunityId: string;
  utility: ReturnType<typeof utilityFor>;
  faceValuePaise: number;
  asOf: string;
  urgencyNudgeBps: number;
}): MatchResult {
  const { scoredOffers, survivors } = scoreOffers({
    offers: bids.map((b) => lenderBidToOffer(b, opportunityId)),
    opportunity: { faceValuePaise },
    utility,
    providerNames: lenderBidProviderNames(bids),
    asOf,
    urgencyNudgeBps,
  });

  // Same dominance analysis the stored path runs. Agent bids are the likelier
  // source of a degenerate set, since they come from a generator rather than
  // from distinct real providers — so this is exactly where the guard earns its
  // place (see #17, where a 10x fee constant skewed every agent bid at once).
  const analysis = analyseFrontier(scoredOffers);
  for (const offer of scoredOffers) {
    offer.dominatedBy = analysis.dominatedBy[offer.offer.id] ?? null;
  }
  const market = {
    frontier: analysis.frontier,
    degeneracyWarning: degeneracyWarning(analysis, scoredOffers),
  };

  if (survivors.length === 0) {
    return {
      status: 'NO_ACCEPTABLE_OFFER',
      opportunityId,
      scoredOffers,
      utility,
      reason: 'No agent bid cleared the supplier gates',
      market,
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
    market,
  };
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
 * alongside the real fields means their integration works without them changing
 * code mid-sprint.
 *
 * **This is a shim, not the contract.** `status` is the real signal, and it
 * distinguishes NO_ACCEPTABLE_OFFER (a legitimate market outcome) from an
 * error — a distinction `matched: false` cannot express. Track 3 should migrate
 * to reading `status` and these fields should then be deleted. Issue #9.
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
