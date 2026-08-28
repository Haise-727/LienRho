// Money and rate arithmetic.
//
// Every rupee figure in this system is a Prisma.Decimal, never a JS number.
// 0.1 + 0.2 !== 0.3 in binary floating point, and a marketplace that quietly
// loses a paisa per posting will not balance — which is the one thing a
// double-entry ledger exists to guarantee.

import { Prisma } from "@/generated/prisma/client";

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

/** Anything constructible into a Decimal. `DecimalValue` is not
 *  reachable as a type namespace under the v7 generated client, so we name it. */
export type DecimalValue = string | number | Prisma.Decimal;

export const ZERO = new Prisma.Decimal(0);
/** Day-count convention for annualising a discount charge. */
export const DAYS_IN_YEAR = new Prisma.Decimal(365);

export function money(value: DecimalValue): Prisma.Decimal {
  // 2dp, half-up: the rounding a bank statement uses.
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function rate(value: DecimalValue): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP);
}

export function sum(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(v), ZERO);
}

/**
 * The economics of one financing offer, from docs/01-commerce-analysis.md §2.
 *
 * Deterministic and pure — no LLM produces any of these figures. This is the
 * named function every rupee in the ledger has to trace back to.
 */
export function quoteEconomics(input: {
  faceValue: DecimalValue;
  advanceRate: DecimalValue;
  annualRate: DecimalValue;
  flatFee: DecimalValue;
  tenorDays: number;
}) {
  const face = new Prisma.Decimal(input.faceValue);
  const tenor = new Prisma.Decimal(input.tenorDays);

  const advance = money(face.times(input.advanceRate));
  const discountCharge = money(
    advance.times(input.annualRate).times(tenor).dividedBy(DAYS_IN_YEAR),
  );
  const fee = money(input.flatFee);
  const netCash = money(advance.minus(discountCharge).minus(fee));
  const reserve = money(face.minus(advance));

  // The honest comparator, and not the headline rate: cost of the money you
  // actually received, for the time you actually had it.
  const effectiveAnnualCost = netCash.isZero()
    ? ZERO
    : rate(
        discountCharge.plus(fee).dividedBy(netCash).times(DAYS_IN_YEAR).dividedBy(tenor),
      );

  return { advance, discountCharge, fee, netCash, reserve, effectiveAnnualCost };
}
