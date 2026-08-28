/**
 * Track 1 (Prisma) -> Track 2 (scoring) conversion.
 *
 * Per the ownership rule in `docs/07-file-ownership.md`: adapters live on the
 * consumer side. Track 1 stores what suits Postgres and the double-entry ledger;
 * Track 2 needs integer paise and basis points. Rather than asking them to
 * change their schema, the conversion happens here.
 *
 * Two representations, both exact, neither wrong:
 *
 *   Track 1  `Decimal(18,2)` rupees, `Decimal(9,6)` rates as fractions (0..1)
 *   Track 2  integer paise, integer basis points (0..10000)
 *
 * **This module deliberately does not import the Prisma client.** It accepts a
 * structural shape instead, so `offer-math`, `score` and the tests stay runnable
 * without a generated client or a database — which is what lets the whole
 * scoring engine be tested in isolation, and what kept Track 2 building while
 * Track 1's schema was still in flight.
 */

import type { IsoDate, Offer, Paise, Bps } from './types';

/**
 * What a Decimal column looks like by the time it reaches us.
 *
 * Prisma hands back a `Decimal` object server-side, and a string once it has
 * been through JSON. Numbers are accepted for seeds and tests. All three are
 * normalised through their decimal *string* form — never through `Number()`,
 * which would reintroduce exactly the float error this project is at pains to
 * avoid.
 */
export type DecimalLike = string | number | { toString(): string };

/** Prisma `Bid` row, structurally. Mirrors `model Bid` in schema.prisma. */
export interface PrismaBidRow {
  id: string;
  opportunityId: string;
  providerId: string;
  advanceRate: DecimalLike;
  annualRate: DecimalLike;
  flatFee: DecimalLike;
  tenorDays: number;
  settlementDays: number;
  recourse: boolean;
  expiresAt: Date | string | null;
}

// -------------------------------------------------------------- conversion

/**
 * Exact decimal-string -> integer, scaled by `10^places`, rounded half-up.
 *
 * Shifts the decimal point by string concatenation rather than multiplying a
 * float. `12.34 * 100` is `1233.9999999999998` in IEEE-754; `Math.round`
 * rescues that particular case but not every case, and the point of integer
 * money is to never let the error in at all. Concatenating the digits and
 * parsing once is exact.
 *
 * Half-up matches Track 1's `money()` convention, so both representations agree
 * at the boundary rather than differing by a paisa on .005 cases.
 *
 * Deliberately not using BigInt: `tsconfig.json` targets ES2017, and that file
 * is shared across all four tracks — bumping it mid-sprint to suit one module
 * is not a trade worth making. `Number` is exact for integers below 2^53, which
 * is ~₹90 trillion in paise, comfortably beyond any invoice this will ever see.
 */
function decimalToScaled(value: DecimalLike, places: number): number {
  const text = String(value).trim();
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.');

  // Keep one extra digit past `places` to decide the rounding.
  const padded = (fraction + '0'.repeat(places + 1)).slice(0, places + 1);
  const kept = padded.slice(0, places);
  const nextDigit = Number(padded[places]);

  // Concatenation is the decimal shift: "1000000" + "00" -> 100000000 paise.
  const scaled = Number((whole || '0') + kept) + (nextDigit >= 5 ? 1 : 0);
  return negative ? -scaled : scaled;
}

/**
 * Rupees -> integer paise. `"1000000.00"` -> `100000000`.
 */
export function decimalToPaise(value: DecimalLike): Paise {
  return decimalToScaled(value, 2);
}

/**
 * Rate fraction -> basis points. `"0.110000"` -> `1100`, `"0.110500"` -> `1105`.
 *
 * Scale 4, because a basis point is 1/10000. The schema stores six decimal
 * places, which is finer than a bp, so sub-bp precision is rounded away here —
 * acceptable because offer rates are quoted in whole bps in practice.
 *
 * This applies to rate *inputs* only. Derived `effectiveCostBps` keeps its
 * fractional part, since ranking on it must not tie genuinely distinct offers
 * (see the Bps note in types.ts).
 */
export function decimalToBps(value: DecimalLike): Bps {
  return decimalToScaled(value, 4);
}

/** `Date` or ISO timestamp -> `YYYY-MM-DD`. */
export function toIsoDate(value: Date | string): IsoDate {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

// ------------------------------------------------------------------ rows

/**
 * Prisma `Bid` -> Track 2 `Offer`.
 *
 * `recourse: true` is read as WITH_RECOURSE, matching the schema's
 * `@default(true)` and the fact that recourse is the lender-favourable default
 * in receivables discounting — non-recourse is the priced upgrade.
 *
 * A null `expiresAt` becomes a far-future date rather than throwing: an
 * unexpiring bid is a seeding convenience, and refusing to score it would make
 * the demo depend on a field nobody set.
 */
export function bidToOffer(row: PrismaBidRow): Offer {
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    providerId: row.providerId,
    advanceRateBps: decimalToBps(row.advanceRate),
    annualRateBps: decimalToBps(row.annualRate),
    feesPaise: decimalToPaise(row.flatFee),
    tenorDays: row.tenorDays,
    settlementDays: row.settlementDays,
    recourse: row.recourse ? 'WITH_RECOURSE' : 'NON_RECOURSE',
    expiresAt: row.expiresAt ? toIsoDate(row.expiresAt) : '9999-12-31',
  };
}
