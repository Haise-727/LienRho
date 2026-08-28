/**
 * The worked example, as an executable test — docs/01-commerce-analysis.md §3.
 *
 * Run: npx tsx --test src/lib/market/offer-math.test.ts
 *
 * This is the project's thesis, so it is a test rather than a paragraph. If this
 * file fails, the demo is wrong and the pitch is wrong, regardless of how good
 * the UI looks. The expected figures below are transcribed from the doc, not
 * from a previous run of this code — otherwise the test would only prove the
 * code agrees with itself.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeOfferEconomics, effectiveCostBps } from './offer-math';
import { formatBps, formatPaise, rupeesToPaise } from './money';
import type { Offer } from './types';

const AS_OF = '2026-08-28';
const FACE_VALUE = rupeesToPaise(1_000_000); // ₹10,00,000
const TENOR_DAYS = 45;

/** Cheap headline rate, low advance, flat fee, slow settlement. */
const OFFER_A: Offer = {
  id: 'offer-a',
  opportunityId: 'opp-1',
  providerId: 'prov-bank',
  advanceRateBps: 8000, // 80%
  annualRateBps: 1100, // 11.0%
  feesPaise: rupeesToPaise(2_500),
  tenorDays: TENOR_DAYS,
  settlementDays: 3, // T+3
  recourse: 'WITH_RECOURSE',
  expiresAt: '2026-08-29',
};

/** Dear headline rate, high advance, no fee, instant settlement. */
const OFFER_B: Offer = {
  id: 'offer-b',
  opportunityId: 'opp-1',
  providerId: 'prov-fintech',
  advanceRateBps: 9500, // 95%
  annualRateBps: 1350, // 13.5%
  feesPaise: 0,
  tenorDays: TENOR_DAYS,
  settlementDays: 0, // T+0
  recourse: 'WITH_RECOURSE',
  expiresAt: '2026-08-29',
};

test('Offer A matches the documented figures', () => {
  const a = computeOfferEconomics(OFFER_A, FACE_VALUE, AS_OF);

  assert.equal(a.advancePaise, rupeesToPaise(800_000), 'advance = ₹8,00,000');
  assert.equal(a.discountChargePaise, rupeesToPaise(10_849.32), 'charge = ₹10,849.32');
  assert.equal(a.netCashPaise, rupeesToPaise(786_650.68), 'net cash = ₹7,86,650.68');
  assert.equal(formatBps(a.effectiveCostBps), '13.76%');
  assert.equal(a.arrivalDate, '2026-08-31', 'T+3 from 28 Aug');
});

test('Offer B matches the documented figures', () => {
  const b = computeOfferEconomics(OFFER_B, FACE_VALUE, AS_OF);

  assert.equal(b.advancePaise, rupeesToPaise(950_000), 'advance = ₹9,50,000');
  assert.equal(b.discountChargePaise, rupeesToPaise(15_811.64), 'charge = ₹15,811.64');
  assert.equal(b.netCashPaise, rupeesToPaise(934_188.36), 'net cash = ₹9,34,188.36');
  assert.equal(formatBps(b.effectiveCostBps), '13.73%');
  assert.equal(b.arrivalDate, AS_OF, 'T+0 lands same day');
});

test('THE THESIS: the dearer headline rate is the cheaper offer', () => {
  const a = computeOfferEconomics(OFFER_A, FACE_VALUE, AS_OF);
  const b = computeOfferEconomics(OFFER_B, FACE_VALUE, AS_OF);

  // Offer B's headline rate is 250bp WORSE...
  assert.ok(OFFER_B.annualRateBps > OFFER_A.annualRateBps);
  assert.equal(OFFER_B.annualRateBps - OFFER_A.annualRateBps, 250);

  // ...yet its effective cost is LOWER. A marketplace that sorts on headline
  // rate does not merely give an incomplete answer here; it gives the wrong one.
  assert.ok(
    b.effectiveCostBps < a.effectiveCostBps,
    `expected B (${formatBps(b.effectiveCostBps)}) cheaper than A (${formatBps(a.effectiveCostBps)})`,
  );

  // ...and it delivers ₹1,47,537.68 more cash, three days sooner.
  const extraCash = b.netCashPaise - a.netCashPaise;
  assert.equal(extraCash, rupeesToPaise(147_537.68), formatPaise(extraCash));
  assert.ok(OFFER_A.settlementDays - OFFER_B.settlementDays === 3);
});

test('an offer whose charges exceed its advance sorts last, not first', () => {
  // Guard against the classic sign/NaN bug: if this returned 0 or NaN, the worst
  // possible offer would rank FIRST and be recommended to the supplier.
  assert.equal(effectiveCostBps(1_000, 0, 0, 45), Infinity);
  assert.equal(effectiveCostBps(1_000, 0, -500, 45), Infinity);
  assert.ok(effectiveCostBps(1_000, 0, 100_000, 45) < Infinity);
});
