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
import { supplierUtilityFromStored } from './utility';
import type { Bps, IsoDate, MatchResult, ScoredOffer } from './types';

/** `FinancingOpportunity` joined to its invoice, structurally. */
export interface PrismaOpportunityRow {
  id: string;
  /** Face value lives on the invoice; requestedAmount may be a partial listing. */
  invoice: { faceValue: DecimalLike };
  sufficiencyFloor: DecimalLike | null;
  timingDeadline: Date | string | null;
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
}: {
  opportunity: PrismaOpportunityRow;
  bids: PrismaBidWithProvider[];
  asOf: IsoDate;
  urgencyNudgeBps?: Bps;
}): MatchResult {
  const utility = supplierUtilityFromStored(
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

  if (survivors.length === 0) {
    return {
      status: 'NO_ACCEPTABLE_OFFER',
      opportunityId: opportunity.id,
      scoredOffers,
      utility,
      reason: explainNoMatch(scoredOffers),
    };
  }

  const winner = survivors[0];
  return {
    status: 'MATCHED',
    opportunityId: opportunity.id,
    allocations: [
      {
        offerId: winner.offer.id,
        providerId: winner.offer.providerId,
        providerName: winner.providerName,
        fundedPaise: winner.advancePaise,
        // Filled in by the allocation step, which re-reads the provider's
        // committed capacity inside a transaction. Left at -1 rather than 0 so
        // an un-allocated result is obviously un-allocated rather than looking
        // like a provider with no money left.
        providerLiquidityAfterPaise: -1,
      },
    ],
    scoredOffers,
    utility,
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
