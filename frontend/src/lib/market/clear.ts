/**
 * Market clearing — the entry point everything else calls.
 *
 * Takes the rows as Track 1 stores them, returns the `MatchResult` that Track 3
 * and Track 4 consume. This is the whole Track 2 pipeline in one function:
 *
 *   Prisma rows -> adapter -> utility gates -> lexicographic scoring -> result
 *
 * **Deliberately free of any database import.** The API route does the querying
 * and hands rows in; this function is pure. That keeps the entire clearing
 * pipeline testable without Postgres, a generated Prisma client, or a running
 * Next.js server — and it is what let Track 2 be built and verified while
 * Track 1's schema was still landing.
 */

import { bidToOffer, decimalToPaise, toIsoDate } from './prisma-adapter';
import type { PrismaBidRow, DecimalLike } from './prisma-adapter';
import { scoreOffers } from './score';
import { analyseFrontier, degeneracyWarning } from './pareto';
import { allocate, explainAllocation } from './allocate';
import type { ProviderCapacity } from './allocate';
import { deriveSupplierUtility, supplierUtilityFromStored } from './utility';
import type { SupplierCashPosition } from './types';
import type { Bps, IsoDate, MatchResult, ScoredOffer } from './types';

/** `FinancingOpportunity` joined to its invoice, structurally. */
export interface PrismaOpportunityRow {
  id: string;
  /** Face value lives on the invoice; requestedAmount may be a partial listing. */
  invoice: { faceValue: DecimalLike };
  sufficiencyFloor: DecimalLike | null;
  timingDeadline: Date | string | null;
  /**
   * The supplier's cash facts, when the caller joined them in.
   *
   * Preferred over the stored columns when present: the gates are then derived
   * from dated obligations at clearing time rather than read from whatever was
   * last written, which is what makes "we infer need from the supplier's real
   * cash position" true rather than aspirational.
   */
  cashPosition?: SupplierCashPosition | null;
}

/** A bid joined to the provider that made it. */
export interface PrismaBidWithProvider extends PrismaBidRow {
  provider: { id: string; name: string };
}

/**
 * Score every bid on an opportunity and decide the outcome.
 *
 * Returns `NO_ACCEPTABLE_OFFER` — a success status, not an error — when nothing
 * clears the supplier's gates. That is a legitimate market result: a market
 * that always transacts is not exercising judgement (docs/01 §7). Callers must
 * branch on `status` rather than assuming a winner exists.
 *
 * Note what is NOT decided here: which provider actually funds, and whether they
 * still have the liquidity and concentration headroom to do so. Ranking and
 * allocation are separate steps, because a provider's position can move between
 * bidding and allocation — that check belongs at allocation time, against a
 * fresh read.
 */
export function clearOpportunity({
  opportunity,
  bids,
  asOf,
  urgencyNudgeBps = 0,
  capacities,
}: {
  opportunity: PrismaOpportunityRow;
  bids: PrismaBidWithProvider[];
  asOf: IsoDate;
  urgencyNudgeBps?: Bps;
  /**
   * Provider capacity read fresh at clearing time. Omit to skip allocation and
   * report the intended winner only — useful for agent bids, which are not
   * backed by a persisted provider record.
   */
  capacities?: Record<string, ProviderCapacity>;
}): MatchResult {
  // Derive from the cash position when we have one; fall back to the stored
  // columns otherwise.
  //
  // The order matters and is not cosmetic. `supplierUtilityFromStored` returns
  // `unconstrained` when both columns are null, which means no gates and
  // cost-only ranking — a *silent* degradation to exactly the behaviour this
  // project exists to argue against. Track 1 nulls those columns on purpose
  // (issue #7) so that the derivation is real, so preferring the position is
  // what keeps the gates alive.
  const utility = opportunity.cashPosition
    ? deriveSupplierUtility(opportunity.cashPosition, asOf)
    : supplierUtilityFromStored(
        opportunity.sufficiencyFloor === null ? null : decimalToPaise(opportunity.sufficiencyFloor),
        opportunity.timingDeadline === null ? null : toIsoDate(opportunity.timingDeadline),
        asOf,
      );

  const providerNames = Object.fromEntries(bids.map((b) => [b.provider.id, b.provider.name]));

  const { scoredOffers, survivors } = scoreOffers({
    offers: bids.map(bidToOffer),
    opportunity: { faceValuePaise: decimalToPaise(opportunity.invoice.faceValue) },
    utility,
    providerNames,
    asOf,
    urgencyNudgeBps,
  });

  // Dominance is annotated onto every offer, not only survivors: a degenerate
  // bid set is a fact about what the providers produced, and filtering to
  // gate-passers first would hide a broken generator behind the gates.
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
      opportunityId: opportunity.id,
      scoredOffers,
      utility,
      reason: explainNoMatch(scoredOffers),
      market,
    };
  }

  const winner = survivors[0];

  // Capacity-aware allocation runs only when the caller supplied a fresh read of
  // provider capacity. Without it we report the intended winner and leave
  // providerLiquidityAfterPaise at -1, so an un-allocated result is obviously
  // un-allocated rather than looking like a provider with no money left.
  if (capacities) {
    const outcome = allocate({
      survivors,
      targetPaise: winner.advancePaise,
      capacities,
    });

    if (outcome.allocations.length === 0) {
      // Offers cleared the supplier's gates but nobody could fund them. That is
      // a different failure from "no offer was good enough", and conflating the
      // two would tell the supplier to change terms when the real answer is to
      // wait for capacity.
      return {
        status: 'NO_ACCEPTABLE_OFFER',
        opportunityId: opportunity.id,
        scoredOffers,
        utility,
        reason: explainAllocation(outcome, winner.advancePaise),
        market,
      };
    }

    return {
      status: 'MATCHED',
      opportunityId: opportunity.id,
      allocations: outcome.allocations,
      scoredOffers,
      utility,
      market,
      allocationNote: explainAllocation(outcome, winner.advancePaise),
      shortfallPaise: outcome.shortfallPaise,
    };
  }

  return {
    status: 'MATCHED',
    opportunityId: opportunity.id,
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

/**
 * Say why nothing cleared, naming the binding constraint.
 *
 * "No offers available" and "three offers, none fast enough" are different
 * situations and a supplier should be able to tell them apart — the second is
 * actionable (extend the deadline, accept less cash), the first is not.
 */
function explainNoMatch(scoredOffers: ScoredOffer[]): string {
  if (scoredOffers.length === 0) return 'No provider bid on this opportunity';

  const failedTiming = scoredOffers.filter((s) => !s.gates.timing.passed).length;
  const failedSufficiency = scoredOffers.filter((s) => !s.gates.sufficiency.passed).length;
  const total = scoredOffers.length;

  if (failedSufficiency === total && failedTiming === total) {
    return `All ${total} offers deliver too little, too late`;
  }
  if (failedSufficiency === total) {
    return `All ${total} offers fall short of the cash needed`;
  }
  if (failedTiming === total) {
    return `All ${total} offers arrive after the deadline`;
  }
  return `None of the ${total} offers clears both the cash floor and the deadline`;
}
