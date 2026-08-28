/**
 * Offer arithmetic — docs/01-commerce-analysis.md §2.
 *
 * These four functions are the product's centre of gravity. They are what turns
 * "Offer A is 11% and Offer B is 13.5%, so A is cheaper" into the correct
 * answer, which is that B is both cheaper AND delivers ₹1.47L more cash.
 *
 * Every function here is pure, deterministic, and named. No LLM produces any of
 * these figures — that boundary is the project's first non-negotiable, and it
 * matters more here than it did in the old build because these numbers price
 * real capital rather than annotate a filing.
 */

import { BPS_SCALE, DAYS_PER_YEAR, applyBps, addDays, roundPaise } from './money';
import type { Bps, IsoDate, Offer, Paise } from './types';

/**
 * Cash paid upfront: `advance = advanceRate x faceValue`.
 *
 * This is the term the headline rate hides. An 80% advance on a cheap rate can
 * deliver far less cash than a 95% advance on a dear one, and on short tenors
 * the advance rate dominates the interest rate outright.
 */
export function advance(faceValuePaise: Paise, advanceRateBps: Bps): Paise {
  return roundPaise(applyBps(faceValuePaise, advanceRateBps));
}

/**
 * Interest on the advance for the tenor: `advance x rate x tenor/365`.
 *
 * Charged on the advance, not on face value — the provider only has the advanced
 * amount at risk. Charging on face value would overstate cost by 1/advanceRate
 * and would make high-advance offers look artificially expensive.
 */
export function discountCharge(
  advancePaise: Paise,
  annualRateBps: Bps,
  tenorDays: number,
): Paise {
  const annualised = applyBps(advancePaise, annualRateBps);
  return roundPaise((annualised * tenorDays) / DAYS_PER_YEAR);
}

/**
 * What actually reaches the bank account:
 * `netCash = advance - discountCharge - fees`.
 *
 * The number that matters to a supplier trying to make payroll. Note the fee is
 * flat and therefore regressive — it consumes a far larger share of a small
 * invoice than a large one, which is exactly why it can erase a headline-rate
 * advantage (docs/01 §2).
 */
export function netCash(
  advancePaise: Paise,
  discountChargePaise: Paise,
  feesPaise: Paise,
): Paise {
  return advancePaise - discountChargePaise - feesPaise;
}

/**
 * The honest comparator:
 * `effectiveCost = (discountCharge + fees) / netCash x 365/tenor`.
 *
 * Two things make this differ from the headline rate, and both are the point of
 * the whole exercise:
 *   1. fees are included, so a "0% fee, higher rate" offer competes fairly;
 *   2. the denominator is net cash RECEIVED, not the advance or the face value —
 *      you are paying for the money you actually got.
 *
 * Returned unrounded (see the Bps note in types.ts): ranking happens on this
 * value, so throwing away the fraction here could tie two distinct offers.
 *
 * Returns Infinity when net cash is zero or negative — an offer whose charges
 * exceed its advance has infinite cost, which sorts last, which is correct.
 * Returning 0 or NaN there would sort it FIRST and hand the supplier the worst
 * possible deal.
 */
export function effectiveCostBps(
  discountChargePaise: Paise,
  feesPaise: Paise,
  netCashPaise: Paise,
  tenorDays: number,
): Bps {
  if (netCashPaise <= 0 || tenorDays <= 0) return Infinity;
  const totalCost = discountChargePaise + feesPaise;
  const periodRate = totalCost / netCashPaise;
  return periodRate * (DAYS_PER_YEAR / tenorDays) * BPS_SCALE;
}

/** When the cash lands: `today + settlementDays`. T+0 lands the same day. */
export function arrivalDate(asOf: IsoDate, settlementDays: number): IsoDate {
  return addDays(asOf, settlementDays);
}

/** Every derived figure for one offer, computed together. */
export interface OfferEconomics {
  advancePaise: Paise;
  discountChargePaise: Paise;
  netCashPaise: Paise;
  effectiveCostBps: Bps;
  arrivalDate: IsoDate;
}

/**
 * Compute the full economics of one offer against one invoice.
 *
 * Single entry point on purpose: the scorer, the API layer and the audit trail
 * all call this, so there is exactly one implementation of the arithmetic and
 * the screen cannot drift from the recorded figures.
 */
export function computeOfferEconomics(
  offer: Offer,
  faceValuePaise: Paise,
  asOf: IsoDate,
): OfferEconomics {
  const advancePaise = advance(faceValuePaise, offer.advanceRateBps);
  const discountChargePaise = discountCharge(
    advancePaise,
    offer.annualRateBps,
    offer.tenorDays,
  );
  const netCashPaise = netCash(advancePaise, discountChargePaise, offer.feesPaise);

  return {
    advancePaise,
    discountChargePaise,
    netCashPaise,
    effectiveCostBps: effectiveCostBps(
      discountChargePaise,
      offer.feesPaise,
      netCashPaise,
      offer.tenorDays,
    ),
    arrivalDate: arrivalDate(asOf, offer.settlementDays),
  };
}
