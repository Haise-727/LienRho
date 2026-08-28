/**
 * Track 3 (NexusX agents) -> Track 2 (scoring) conversion.
 *
 * Track 3's `LenderBid` (`ai/nexus/schemas.py`) and Track 2's `Offer` describe
 * the same thing in different units. Per `docs/07-file-ownership.md`, the
 * adapter lives on the consumer side, so the mapping is here rather than being
 * a change requested of their agents.
 *
 * Track 3 already fixed the one difference that could not be adapted away
 * (issue #9): `feesPaise` is an absolute amount, not a rate. A proportional fee
 * would have broken the worked example, because the flatness of Offer A's
 * ₹2,500 fee is exactly what makes an 11.0% offer lose to a 13.5% one.
 *
 * What remains is mechanical: fractions to basis points, hours to days.
 */

import type { Offer } from './types';

/** `LenderBid` as it arrives over the wire, camelCased by Pydantic aliases. */
export interface LenderBidPayload {
  providerId: string;
  providerName: string;
  /** 0..1 fraction. */
  advanceRate: number;
  /** 0..1 fraction. */
  apr: number;
  /** Already an absolute paise amount (issue #9). */
  feesPaise: number;
  disbursalLatencyHours: number;
  tenorDays: number;
  recourse: boolean;
  expiresAt?: string | null;
  /** Agent's own confidence. Not consumed by scoring — judgement, not arithmetic. */
  confidence?: number;
  notes?: string;
  simulated?: boolean;
}

/**
 * Hours -> whole settlement days, rounding **up**.
 *
 * 30 hours is not "one day" for a supplier with a deadline: the cash has not
 * landed until the day it lands. Rounding down would let an offer clear a
 * timing gate it actually misses, which is the one direction of error that
 * hands the supplier a deal that fails them.
 */
export function latencyHoursToDays(hours: number): number {
  return Math.ceil(Math.max(0, hours) / 24);
}

/**
 * Fraction -> basis points.
 *
 * `Math.round` is load-bearing: 0.8 is not exactly representable in binary, so
 * `0.8 * 10000` is `8000.000000000001`. Truncation would give 8000 here but
 * 1099 for an 11% rate, which is a silent 1bp error on every offer.
 */
function fractionToBps(fraction: number): number {
  return Math.round(fraction * 10_000);
}

/**
 * Track 3 `LenderBid` -> Track 2 `Offer`.
 *
 * `LenderBid` carries no bid id of its own, so the provider id stands in. That
 * is safe here because one provider bids at most once per opportunity — the
 * same assumption Track 1's schema encodes as `@@unique([opportunityId,
 * providerId])` on `Bid`.
 */
export function lenderBidToOffer(bid: LenderBidPayload, opportunityId: string): Offer {
  return {
    id: bid.providerId,
    opportunityId,
    providerId: bid.providerId,
    advanceRateBps: fractionToBps(bid.advanceRate),
    annualRateBps: fractionToBps(bid.apr),
    feesPaise: Math.round(bid.feesPaise),
    tenorDays: bid.tenorDays,
    settlementDays: latencyHoursToDays(bid.disbursalLatencyHours),
    recourse: bid.recourse ? 'WITH_RECOURSE' : 'NON_RECOURSE',
    expiresAt: bid.expiresAt ? bid.expiresAt.slice(0, 10) : '9999-12-31',
  };
}

/** Provider display names, keyed by id, for the scored output. */
export function lenderBidProviderNames(bids: LenderBidPayload[]): Record<string, string> {
  return Object.fromEntries(bids.map((b) => [b.providerId, b.providerName]));
}
