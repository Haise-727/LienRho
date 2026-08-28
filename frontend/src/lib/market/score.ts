/**
 * Lexicographic scoring — docs/01-commerce-analysis.md §4, docs/03 Module 7.
 *
 * The mechanism, in one line: **sufficiency and timing are gates; cost ranks
 * whatever survives them.**
 *
 * Why not a weighted sum. A weighted score lets a very cheap, very slow offer
 * outrank a slightly dearer one that actually makes payroll — the offers get
 * averaged into commensurability they don't have. That is precisely the failure
 * PS-5 describes, so the thing we are supposed to be fixing cannot be built on
 * the mechanism that causes it. Gates are also far easier to defend out loud:
 * "this offer doesn't cover what you need" beats "this offer scores 0.71".
 *
 * Everything here is deterministic and inspectable. No model touches any of it.
 */

import { computeOfferEconomics } from './offer-math';
import { addBusinessDays, formatPaise, isOnOrBefore } from './money';
import type {
  Bps,
  FinancingOpportunity,
  GateOutcome,
  IsoDate,
  Offer,
  ScoredOffer,
  SupplierUtility,
} from './types';

/**
 * Maximum extra cost, in basis points, a supplier is treated as willing to pay
 * for one day earlier arrival when the urgency nudge is at its limit.
 *
 * This exists so the Track 4 slider does something real without reintroducing
 * opaque weights. It is an *exchange rate* with a unit a person can argue with
 * — "I'd pay up to 50bp a day to get paid sooner" — rather than a dimensionless
 * weight nobody can sanity-check.
 *
 * It only ever reorders offers that already cleared both gates. It cannot
 * rescue a disqualified offer, which is what keeps the gates absolute.
 */
const MAX_URGENCY_PREMIUM_BPS_PER_DAY = 50;

/** Result of scoring a whole opportunity. */
export interface ScoringResult {
  scoredOffers: ScoredOffer[];
  /** Offers that cleared every gate, best first. Empty means no acceptable offer. */
  survivors: ScoredOffer[];
  utility: SupplierUtility;
}

/**
 * Does this offer deliver enough cash?
 *
 * An offer below the floor does not "score lower" — it fails to solve the
 * problem the supplier has, so it is out regardless of how cheap it is.
 */
function sufficiencyGate(netCashPaise: number, utility: SupplierUtility): GateOutcome {
  if (utility.unconstrained) {
    return { passed: true, reason: 'No projected shortfall — any amount helps' };
  }
  if (netCashPaise >= utility.sufficiencyFloorPaise) {
    return {
      passed: true,
      reason: `Delivers ${formatPaise(netCashPaise)}, covering the ${formatPaise(
        utility.sufficiencyFloorPaise,
      )} needed`,
    };
  }
  return {
    passed: false,
    reason: `Delivers only ${formatPaise(netCashPaise)} of the ${formatPaise(
      utility.sufficiencyFloorPaise,
    )} needed${utility.drivingObligation ? ` for ${utility.drivingObligation}` : ''}`,
  };
}

/**
 * Does the cash land in time?
 *
 * Cash that arrives after the deadline has failed, however cheap it was. This is
 * the gate that makes settlement speed a first-class term rather than a
 * tie-breaker.
 */
function timingGate(arrivalDate: IsoDate, utility: SupplierUtility): GateOutcome {
  if (utility.unconstrained) {
    return { passed: true, reason: 'No deadline in play' };
  }
  if (isOnOrBefore(arrivalDate, utility.timingDeadline)) {
    return {
      passed: true,
      reason: `Lands ${arrivalDate}, before the ${utility.timingDeadline} deadline`,
    };
  }
  return {
    passed: false,
    reason: `Lands ${arrivalDate}, after the ${utility.timingDeadline} deadline${
      utility.drivingObligation ? ` for ${utility.drivingObligation}` : ''
    }`,
  };
}

/**
 * Rank key for offers that cleared both gates.
 *
 * Default (`urgencyNudgeBps` = 0) is pure effective cost — the honest
 * comparator. As the nudge rises the supplier is treated as willing to pay a
 * stated premium per day saved, so a faster offer can overtake a marginally
 * cheaper one. Lower is better.
 */
function rankKey(
  offer: ScoredOffer,
  earliestArrival: IsoDate,
  urgencyNudgeBps: Bps,
): number {
  if (urgencyNudgeBps <= 0) return offer.effectiveCostBps;

  const premiumPerDay = (urgencyNudgeBps / 10_000) * MAX_URGENCY_PREMIUM_BPS_PER_DAY;
  const daysLate = Math.max(
    0,
    Math.round(
      (new Date(`${offer.arrivalDate}T00:00:00Z`).getTime() -
        new Date(`${earliestArrival}T00:00:00Z`).getTime()) /
        86_400_000,
    ),
  );
  return offer.effectiveCostBps + daysLate * premiumPerDay;
}

/**
 * Score and rank every offer for one opportunity.
 *
 * Order of operations is the whole design: compute economics, apply both gates,
 * then rank only the survivors. Disqualified offers keep their computed figures
 * and their failing reason so the UI can show *why* they lost rather than
 * hiding them — a market that silently drops options is harder to trust than
 * one that shows its working.
 */
export function scoreOffers({
  offers,
  opportunity,
  utility,
  providerNames,
  asOf,
  urgencyNudgeBps = 0,
}: {
  offers: Offer[];
  opportunity: Pick<FinancingOpportunity, 'faceValuePaise'>;
  utility: SupplierUtility;
  providerNames: Record<string, string>;
  asOf: IsoDate;
  urgencyNudgeBps?: Bps;
}): ScoringResult {
  const scored: ScoredOffer[] = offers.map((offer) => {
    const economics = computeOfferEconomics(offer, opportunity.faceValuePaise, asOf);

    // Settlement is quoted in BUSINESS days (Track 1 schema, issue #6). T+3 from
    // a Friday is Wednesday, not Monday — a four-day error on exactly the axis
    // the timing gate tests.
    const arrival = addBusinessDays(asOf, offer.settlementDays);

    const sufficiency = sufficiencyGate(economics.netCashPaise, utility);
    const timing = timingGate(arrival, utility);

    return {
      offer,
      providerName: providerNames[offer.providerId] ?? offer.providerId,
      advancePaise: economics.advancePaise,
      discountChargePaise: economics.discountChargePaise,
      netCashPaise: economics.netCashPaise,
      effectiveCostBps: economics.effectiveCostBps,
      arrivalDate: arrival,
      gates: { sufficiency, timing },
      disqualified: !sufficiency.passed || !timing.passed,
      rank: null,
    };
  });

  const survivors = scored.filter((s) => !s.disqualified);

  // Earliest arrival among survivors is the reference point for the urgency
  // premium — the premium prices days saved relative to the best available
  // speed, not against an arbitrary origin.
  const earliestArrival = survivors.reduce<IsoDate>(
    (earliest, s) => (isOnOrBefore(s.arrivalDate, earliest) ? s.arrivalDate : earliest),
    survivors[0]?.arrivalDate ?? asOf,
  );

  survivors.sort((a, b) => {
    const delta =
      rankKey(a, earliestArrival, urgencyNudgeBps) -
      rankKey(b, earliestArrival, urgencyNudgeBps);
    // Ties broken by net cash, descending. Equal cost for more money is strictly
    // better, and a deterministic tie-break keeps the ranking stable across runs.
    return delta !== 0 ? delta : b.netCashPaise - a.netCashPaise;
  });

  survivors.forEach((s, index) => {
    s.rank = index + 1;
  });

  return { scoredOffers: scored, survivors, utility };
}
