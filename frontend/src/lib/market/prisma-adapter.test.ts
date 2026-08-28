/**
 * Adapter tests — Track 1's Decimal representation into Track 2's integers.
 *
 * Run: npx tsx --test src/lib/market/prisma-adapter.test.ts
 *
 * These are boundary-conversion tests, which is where money bugs actually live.
 * The conversions look trivial and are not: the naive `Number(x) * 100` passes
 * every obvious case and fails on values like 12.34.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bidToOffer, decimalToBps, decimalToPaise, toIsoDate } from './prisma-adapter';

test('rupee decimals convert to exact paise', () => {
  assert.equal(decimalToPaise('1000000.00'), 100_000_000);
  assert.equal(decimalToPaise('2500.00'), 250_000);
  assert.equal(decimalToPaise('0.00'), 0);
  assert.equal(decimalToPaise('786650.68'), 78_665_068);
});

test('conversion does not go through float', () => {
  // The canonical trap: 12.34 * 100 === 1233.9999999999998 in IEEE-754.
  assert.equal(decimalToPaise('12.34'), 1234);
  assert.equal(decimalToPaise(12.34), 1234);
  // A value large enough that float would have lost integer precision.
  assert.equal(decimalToPaise('99999999999.99'), 9_999_999_999_999);
});

test('half-up rounding matches Track 1 money() convention', () => {
  assert.equal(decimalToPaise('1.005'), 101, '.005 rounds up');
  assert.equal(decimalToPaise('1.004'), 100, '.004 rounds down');
  assert.equal(decimalToPaise('1.999'), 200);
});

test('missing and short fractions are handled', () => {
  assert.equal(decimalToPaise('100'), 10_000, 'no decimal point');
  assert.equal(decimalToPaise('100.5'), 10_050, 'one decimal place');
});

test('negative amounts keep their sign', () => {
  // The ledger has credits; a sign bug here would silently flip a posting.
  assert.equal(decimalToPaise('-2500.00'), -250_000);
  assert.equal(decimalToPaise('-1.005'), -101);
});

test('rate fractions convert to basis points without losing sub-percent precision', () => {
  assert.equal(decimalToBps('0.110000'), 1100, '11.0%');
  assert.equal(decimalToBps('0.135000'), 1350, '13.5%');
  assert.equal(decimalToBps('0.800000'), 8000, '80% advance rate');
  // The case a paise-scaled converter would get wrong by rounding to 1100.
  assert.equal(decimalToBps('0.110500'), 1105, '11.05% must not collapse to 11%');
  assert.equal(decimalToBps('0.000000'), 0);
});

test('dates reduce to calendar days in UTC', () => {
  assert.equal(toIsoDate('2026-08-28T00:00:00.000Z'), '2026-08-28');
  assert.equal(toIsoDate(new Date('2026-08-28T18:30:00.000Z')), '2026-08-28');
});

test('a Bid row becomes the Offer the scorer expects', () => {
  // Offer A from the worked example, in Track 1's storage representation.
  const offer = bidToOffer({
    id: 'bid-a',
    opportunityId: 'opp-1',
    providerId: 'prov-bank',
    advanceRate: '0.800000',
    annualRate: '0.110000',
    flatFee: '2500.00',
    tenorDays: 45,
    settlementDays: 3,
    recourse: true,
    expiresAt: new Date('2026-08-29T00:00:00.000Z'),
  });

  assert.deepEqual(offer, {
    id: 'bid-a',
    opportunityId: 'opp-1',
    providerId: 'prov-bank',
    advanceRateBps: 8000,
    annualRateBps: 1100,
    feesPaise: 250_000,
    tenorDays: 45,
    settlementDays: 3,
    recourse: 'WITH_RECOURSE',
    expiresAt: '2026-08-29',
  });
});

test('a null expiry does not make a bid unscoreable', () => {
  const offer = bidToOffer({
    id: 'bid-x',
    opportunityId: 'opp-1',
    providerId: 'p',
    advanceRate: '0.9',
    annualRate: '0.12',
    flatFee: '0.00',
    tenorDays: 30,
    settlementDays: 0,
    recourse: false,
    expiresAt: null,
  });

  assert.equal(offer.expiresAt, '9999-12-31');
  assert.equal(offer.recourse, 'NON_RECOURSE');
});
