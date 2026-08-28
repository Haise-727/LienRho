/**
 * Lexicographic scoring tests — the situational half of docs/01 §3.
 *
 * Run: npx tsx --test src/lib/market/score.test.ts
 *
 * `offer-math.test.ts` proves the arithmetic. This file proves the *judgement*:
 * that a cheaper offer which cannot solve the supplier's problem is disqualified
 * rather than merely ranked lower. That distinction is the product.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deriveSupplierUtility, supplierUtilityFromStored } from './utility';
import { scoreOffers } from './score';
import { rupeesToPaise } from './money';
import type { Offer, SupplierCashPosition } from './types';

// Wednesday. Chosen so T+3 business days crosses a weekend and lands Monday —
// the case where calendar-day maths would silently give the wrong answer.
const AS_OF = '2026-08-26';
const FRIDAY = '2026-08-28';
const FACE_VALUE = rupeesToPaise(1_000_000);

const PROVIDERS = { 'prov-bank': 'Meridian Bank', 'prov-fintech': 'Swiftly' };

/** Cheap headline rate, low advance, flat fee, slow settlement. */
const OFFER_A: Offer = {
  id: 'offer-a',
  opportunityId: 'opp-1',
  providerId: 'prov-bank',
  advanceRateBps: 8000,
  annualRateBps: 1100,
  feesPaise: rupeesToPaise(2_500),
  tenorDays: 45,
  settlementDays: 3,
  recourse: 'WITH_RECOURSE',
  expiresAt: '2026-08-27',
};

/** Dear headline rate, high advance, no fee, instant settlement. */
const OFFER_B: Offer = {
  id: 'offer-b',
  opportunityId: 'opp-1',
  providerId: 'prov-fintech',
  advanceRateBps: 9500,
  annualRateBps: 1350,
  feesPaise: 0,
  tenorDays: 45,
  settlementDays: 0,
  recourse: 'WITH_RECOURSE',
  expiresAt: '2026-08-27',
};

const score = (utility: ReturnType<typeof supplierUtilityFromStored>, nudge = 0) =>
  scoreOffers({
    offers: [OFFER_A, OFFER_B],
    opportunity: { faceValuePaise: FACE_VALUE },
    utility,
    providerNames: PROVIDERS,
    asOf: AS_OF,
    urgencyNudgeBps: nudge,
  });

test('derives the gates from the cash position rather than being told', () => {
  // Payroll of ₹12L on Friday against ₹4L cash and a ₹1L buffer.
  // Shortfall = 1,00,000 - (4,00,000 - 12,00,000) = ₹9,00,000.
  const position: SupplierCashPosition = {
    currentCashPaise: rupeesToPaise(400_000),
    cashThresholdPaise: rupeesToPaise(100_000),
    obligations: [
      { label: 'August payroll', amountPaise: rupeesToPaise(1_200_000), dueDate: FRIDAY },
      { label: 'Rent', amountPaise: rupeesToPaise(50_000), dueDate: '2026-09-30' },
    ],
  };

  const utility = deriveSupplierUtility(position, AS_OF);

  assert.equal(utility.sufficiencyFloorPaise, rupeesToPaise(900_000));
  assert.equal(utility.timingDeadline, FRIDAY);
  assert.equal(utility.drivingObligation, 'August payroll');
  assert.equal(utility.unconstrained, false);
});

test('THE THESIS: the cheap offer is disqualified on BOTH count and clock', () => {
  const utility = supplierUtilityFromStored(rupeesToPaise(900_000), FRIDAY, AS_OF);
  const { scoredOffers, survivors } = score(utility);

  const a = scoredOffers.find((s) => s.offer.id === 'offer-a')!;
  const b = scoredOffers.find((s) => s.offer.id === 'offer-b')!;

  // Offer A: ₹7.87L against ₹9L needed, landing Monday against a Friday
  // deadline. Fails on both, exactly as docs/01 §3 describes.
  assert.equal(a.disqualified, true);
  assert.equal(a.gates.sufficiency.passed, false);
  assert.equal(a.gates.timing.passed, false);
  assert.equal(a.arrivalDate, '2026-08-31', 'T+3 business days from Wed = Mon');
  assert.equal(a.rank, null, 'disqualified offers are not ranked');

  // Offer B clears both and wins.
  assert.equal(b.disqualified, false);
  assert.equal(b.arrivalDate, AS_OF, 'T+0 lands same day');
  assert.equal(b.rank, 1);

  assert.equal(survivors.length, 1);
  assert.equal(survivors[0].offer.id, 'offer-b');

  // The failing reasons are renderable, not just booleans — Track 4 shows these.
  assert.match(a.gates.sufficiency.reason, /Delivers only/);
  assert.match(a.gates.timing.reason, /after the 2026-08-28 deadline/);
});

test('a weighted sum would have got this wrong', () => {
  // Sanity-check the claim the design rests on: on pure cost, A is competitive
  // (13.76% vs 13.73%) and any smooth scoring function would rank it a close
  // second rather than excluding it. The gates are what make it excluded.
  const unconstrained = supplierUtilityFromStored(null, null, AS_OF);
  const { survivors } = score(unconstrained);

  assert.equal(survivors.length, 2, 'with no shortfall, nothing is gated out');
  assert.equal(survivors[0].offer.id, 'offer-b', 'B still wins on effective cost');
  // ...but A is only ~3bp behind, which is why "rank by score" hides the problem.
  const gap = survivors[1].effectiveCostBps - survivors[0].effectiveCostBps;
  assert.ok(gap > 0 && gap < 10, `expected a sub-10bp gap, got ${gap.toFixed(2)}bp`);
});

test('no acceptable offer is a real outcome, not an error', () => {
  // Nobody can deliver ₹20L from a ₹10L invoice.
  const impossible = supplierUtilityFromStored(rupeesToPaise(2_000_000), FRIDAY, AS_OF);
  const { survivors, scoredOffers } = score(impossible);

  assert.equal(survivors.length, 0);
  // Every offer still carries its figures and its reason, so the UI can explain
  // why nothing cleared rather than showing an empty screen.
  assert.equal(scoredOffers.length, 2);
  assert.ok(scoredOffers.every((s) => s.disqualified));
  assert.ok(scoredOffers.every((s) => s.netCashPaise > 0));
});

test('the urgency nudge reorders survivors but cannot rescue a disqualified offer', () => {
  // Both offers clear the gates when the floor is low.
  const easy = supplierUtilityFromStored(rupeesToPaise(500_000), '2026-09-30', AS_OF);

  const pureCost = score(easy, 0);
  assert.equal(pureCost.survivors[0].offer.id, 'offer-b');
  assert.equal(pureCost.survivors.length, 2);

  // At maximum urgency the ordering may change, but membership must not.
  const maxUrgency = score(easy, 10_000);
  assert.equal(maxUrgency.survivors.length, 2, 'the nudge never gates anything out');

  // And with a binding floor, no amount of urgency admits the failing offer.
  const strict = supplierUtilityFromStored(rupeesToPaise(900_000), FRIDAY, AS_OF);
  assert.equal(score(strict, 10_000).survivors.length, 1);
});
