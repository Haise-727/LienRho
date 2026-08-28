/**
 * Exact money and date primitives for the marketplace.
 *
 * Everything financial in Track 2 goes through here. The rule: money is an
 * integer number of paise, and it only becomes a float at the moment it is
 * formatted for a human.
 *
 * Why this file exists at all — docs/01-commerce-analysis.md §3 hangs the entire
 * product thesis on Offer B being cheaper than Offer A by 3 basis points
 * (13.73% vs 13.76%). Accumulated IEEE-754 error across advance -> discount ->
 * net -> effective-cost is comfortably capable of moving a result by more than
 * 3bp, which would mean float noise silently picking the demo's winner. So the
 * arithmetic is done in integers and rounded exactly once, at a defined point.
 */

import type { Bps, IsoDate, Paise } from './types';

/** Paise in a rupee. */
export const PAISE_PER_RUPEE = 100;

/** Basis points in 100%. 10000bp = 1.0. */
export const BPS_SCALE = 10000;

/** Day-count convention. Actual/365 — matches the docs/01 §2 formulas. */
export const DAYS_PER_YEAR = 365;

// ------------------------------------------------------------------ money

/**
 * Rupees -> paise. Use at the seed/input boundary only.
 *
 * Rounds rather than truncates: `12.34` arrives from JSON as 12.339999999999998,
 * and truncation would silently shave a paise off every such value.
 */
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** Paise -> rupees. Display boundary only — never feed the result back into math. */
export function paiseToRupees(paise: Paise): number {
  return paise / PAISE_PER_RUPEE;
}

/**
 * The one sanctioned rounding point.
 *
 * Every intermediate stays a full-precision float; results are snapped to whole
 * paise exactly once, when they become a reportable figure. Rounding at every
 * step would compound bias; never rounding would leak fractional paise into
 * comparisons that are supposed to be exact.
 */
export function roundPaise(value: number): Paise {
  return Math.round(value);
}

/**
 * Apply a basis-point rate to a paise amount. `10000bp` returns the input.
 *
 * Deliberately returns an unrounded float so callers can chain (e.g. advance ->
 * discount charge) without rounding twice. Call `roundPaise` on the final figure.
 */
export function applyBps(amountPaise: Paise, rate: Bps): number {
  return (amountPaise * rate) / BPS_SCALE;
}

/** Format paise as Indian-grouped rupees, e.g. `₹7,86,650.68`. */
export function formatPaise(paise: Paise): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paiseToRupees(paise));
}

/** Format basis points as a percentage, e.g. `13.76%`. */
export function formatBps(bps: Bps, fractionDigits = 2): string {
  return `${(bps / 100).toFixed(fractionDigits)}%`;
}

// ------------------------------------------------------------------- dates

/**
 * Date maths in UTC.
 *
 * `new Date('2026-08-28')` parses as UTC midnight, but `getDate()`/`setDate()`
 * read local time — so west of UTC the day silently shifts back by one. A
 * settlement date being wrong by a day would break the timing gate, which is
 * one of the two things that disqualifies an offer. Hence UTC accessors
 * throughout.
 */
export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const MS_PER_DAY = 86_400_000;
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/** True when `date` is on or before `deadline`. Landing ON the deadline counts. */
export function isOnOrBefore(date: IsoDate, deadline: IsoDate): boolean {
  return daysBetween(date, deadline) >= 0;
}

/** Saturday or Sunday. Bank holidays are not modelled — see addBusinessDays. */
export function isWeekend(date: IsoDate): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Add N business days, skipping weekends.
 *
 * Settlement is quoted in business days (T+0 / T+1 / T+3), and the distinction
 * from calendar days is not cosmetic: T+3 business days from a Friday lands on
 * Wednesday, not Monday. That is a four-day difference on the exact axis the
 * timing gate tests, so using calendar days here would let offers clear a
 * Friday deadline that in reality miss it — and "this offer arrives too late"
 * is the demo's whole point.
 *
 * T+0 means same day, so zero advances nothing — but a T+0 quote issued on a
 * Saturday still cannot land until Monday, hence the roll-forward before the
 * loop.
 *
 * Bank holidays are deliberately not modelled: a holiday calendar is real work,
 * it varies by state in India, and being wrong about weekends is the error that
 * actually moves a result. Worth stating out loud rather than implying a
 * precision the code doesn't have.
 */
export function addBusinessDays(date: IsoDate, businessDays: number): IsoDate {
  let cursor = date;
  while (isWeekend(cursor)) cursor = addDays(cursor, 1);

  let remaining = businessDays;
  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    if (!isWeekend(cursor)) remaining -= 1;
  }
  return cursor;
}
