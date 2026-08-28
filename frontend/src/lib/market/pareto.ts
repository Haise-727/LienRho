/**
 * Pareto dominance over the offer set.
 *
 * Two jobs, and it is worth being clear that neither of them is choosing the
 * winner — the lexicographic gates in `score.ts` do that, and cost breaks the
 * tie among survivors. Nothing here changes who wins.
 *
 *   1. **A degeneracy guard.** If one offer beats every other on every axis,
 *      the bid set is broken rather than the market competitive. That is what a
 *      mispriced generator produces — we have already shipped exactly that (the
 *      agent fees were 10x too large, #17), and no unit test catches it because
 *      every individual calculation is correct. This is the check that does.
 *
 *   2. **Noise reduction.** An offer that is worse than some other offer on
 *      every axis is not a choice, it is clutter. The non-dominated set is what
 *      deserves a person's attention, which gives a principled answer to
 *      "show all bids or just the winner" (05-decisions-needed.md §4): show the
 *      frontier, highlight the winner, collapse the rest.
 *
 * Deterministic and pure, like everything else in this layer.
 */

import { daysBetween } from './money';
import type { ScoredOffer } from './types';

/**
 * The three axes a supplier actually trades off.
 *
 * Deliberately not including headline rate: it is not an outcome, it is an
 * input to one, and including it would let a cheap-looking offer appear on the
 * frontier on the strength of the number this whole project argues against.
 */
export interface OfferAxes {
  /** Higher is better. */
  netCashPaise: number;
  /** Lower is better. */
  effectiveCostBps: number;
  /** Earlier is better. */
  arrivalDate: string;
}

function axesOf(offer: ScoredOffer): OfferAxes {
  return {
    netCashPaise: offer.netCashPaise,
    effectiveCostBps: offer.effectiveCostBps,
    arrivalDate: offer.arrivalDate,
  };
}

/**
 * Does `a` dominate `b`?
 *
 * Standard Pareto dominance: at least as good on every axis, and strictly
 * better on at least one. The "strictly better on one" clause matters — without
 * it two identical offers would dominate each other, and every offer would be
 * excluded from its own frontier.
 */
export function dominates(a: OfferAxes, b: OfferAxes): boolean {
  const cashAtLeast = a.netCashPaise >= b.netCashPaise;
  const costAtLeast = a.effectiveCostBps <= b.effectiveCostBps;
  const timeAtLeast = daysBetween(a.arrivalDate, b.arrivalDate) >= 0;
  if (!cashAtLeast || !costAtLeast || !timeAtLeast) return false;

  const cashBetter = a.netCashPaise > b.netCashPaise;
  const costBetter = a.effectiveCostBps < b.effectiveCostBps;
  const timeBetter = daysBetween(a.arrivalDate, b.arrivalDate) > 0;
  return cashBetter || costBetter || timeBetter;
}

/** Result of analysing the offer set. */
export interface FrontierAnalysis {
  /** Offer ids on the non-dominated frontier. */
  frontier: string[];
  /** For each dominated offer, the id of an offer that beats it outright. */
  dominatedBy: Record<string, string>;
  /**
   * True when a single offer dominates every other offer in the set.
   *
   * This is a **red flag about the bid data, not a result**. A real market
   * produces trade-offs; if one offer is simply better in every respect then
   * the others were not competing, and something upstream is generating them
   * wrongly.
   */
  degenerate: boolean;
  /** The dominating offer when `degenerate`, so the warning can name it. */
  degenerateWinner: string | null;
}

/**
 * Analyse dominance across a scored offer set.
 *
 * Runs over **every** offer, not only the survivors. Degeneracy is a property
 * of what the providers bid, and filtering to gate-passers first would hide a
 * broken generator behind the gates.
 *
 * O(n²), which is correct for a set this size — an auction has tens of bids,
 * not millions, and the obvious implementation is the one that stays readable.
 */
export function analyseFrontier(offers: ScoredOffer[]): FrontierAnalysis {
  const frontier: string[] = [];
  const dominatedBy: Record<string, string> = {};

  for (const candidate of offers) {
    const beatenBy = offers.find(
      (other) =>
        other.offer.id !== candidate.offer.id &&
        dominates(axesOf(other), axesOf(candidate)),
    );
    if (beatenBy) dominatedBy[candidate.offer.id] = beatenBy.offer.id;
    else frontier.push(candidate.offer.id);
  }

  // Degenerate when exactly one offer stands and it beat everything else. With
  // fewer than two offers there is nothing to compare, so nothing to flag.
  const degenerate =
    offers.length > 1 && frontier.length === 1 && Object.keys(dominatedBy).length === offers.length - 1;

  return {
    frontier,
    dominatedBy,
    degenerate,
    degenerateWinner: degenerate ? frontier[0] : null,
  };
}

/**
 * Human-readable warning for a degenerate offer set, or `null` when healthy.
 *
 * Returned as text rather than thrown: a degenerate set is still scoreable and
 * refusing to clear would be worse than clearing with a warning attached. The
 * point is that it stops being invisible.
 */
export function degeneracyWarning(
  analysis: FrontierAnalysis,
  offers: ScoredOffer[],
): string | null {
  if (!analysis.degenerate || !analysis.degenerateWinner) return null;

  const winner = offers.find((o) => o.offer.id === analysis.degenerateWinner);
  const name = winner?.providerName ?? analysis.degenerateWinner;

  return (
    `${name} dominates all ${offers.length - 1} other offers on cash, cost and speed ` +
    `simultaneously. A competitive market produces trade-offs, so this usually means ` +
    `the bids were generated wrongly rather than that one provider is simply better.`
  );
}
