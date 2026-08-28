/**
 * Dominance and degeneracy tests.
 *
 * Run: npx tsx --test src/lib/market/pareto.test.ts
 *
 * The degeneracy guard is the reason this module exists, so most of the weight
 * here is on it firing when it should and staying quiet when it should not. A
 * guard that cries wolf gets ignored, and one that never fires is decoration.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analyseFrontier, degeneracyWarning, dominates } from './pareto';
import { rupeesToPaise } from './money';
import type { Offer, ScoredOffer } from './types';

function offer(
  id: string,
  netCashRupees: number,
  costBps: number,
  arrivalDate: string,
): ScoredOffer {
  const stub: Offer = {
    id,
    opportunityId: 'opp-1',
    providerId: `prov-${id}`,
    advanceRateBps: 8000,
    annualRateBps: 1100,
    feesPaise: 0,
    tenorDays: 45,
    settlementDays: 0,
    recourse: 'WITH_RECOURSE',
    expiresAt: '2026-12-31',
  };
  return {
    offer: stub,
    providerName: `Provider ${id.toUpperCase()}`,
    advancePaise: rupeesToPaise(netCashRupees),
    discountChargePaise: 0,
    netCashPaise: rupeesToPaise(netCashRupees),
    effectiveCostBps: costBps,
    arrivalDate,
    gates: {
      sufficiency: { passed: true, reason: '' },
      timing: { passed: true, reason: '' },
    },
    disqualified: false,
    rank: null,
    dominatedBy: null,
  };
}

test('dominance requires being at least as good everywhere and better somewhere', () => {
  const better = { netCashPaise: 1000, effectiveCostBps: 1300, arrivalDate: '2026-08-28' };
  const worse = { netCashPaise: 900, effectiveCostBps: 1400, arrivalDate: '2026-08-31' };

  assert.equal(dominates(better, worse), true);
  assert.equal(dominates(worse, better), false);
});

test('an identical offer does not dominate its twin', () => {
  // Without the "strictly better on one axis" clause, identical offers would
  // dominate each other and every offer would be excluded from its own
  // frontier — leaving an empty frontier and no offers to show.
  const a = { netCashPaise: 1000, effectiveCostBps: 1300, arrivalDate: '2026-08-28' };
  const b = { ...a };

  assert.equal(dominates(a, b), false);
  assert.equal(dominates(b, a), false);
});

test('a genuine trade-off leaves both offers on the frontier', () => {
  // More cash but slower, against less cash but instant. Neither dominates —
  // this is what a real market looks like, and what makes comparison a
  // judgement rather than a lookup.
  const offers = [
    offer('a', 950_000, 1373, '2026-09-02'),
    offer('b', 900_000, 1350, '2026-08-28'),
  ];

  const analysis = analyseFrontier(offers);

  assert.deepEqual(analysis.frontier.sort(), ['a', 'b']);
  assert.deepEqual(analysis.dominatedBy, {});
  assert.equal(analysis.degenerate, false);
  assert.equal(degeneracyWarning(analysis, offers), null);
});

test('THE GUARD: one offer beating everything on every axis is flagged', () => {
  // This is what a mispriced generator produces — see #17, where a 10x fee
  // constant skewed every agent bid in the same direction. Each individual
  // calculation is correct, so no arithmetic test catches it.
  const offers = [
    offer('super', 990_000, 1200, '2026-08-28'),
    offer('mid', 900_000, 1350, '2026-08-31'),
    offer('poor', 850_000, 1400, '2026-09-02'),
  ];

  const analysis = analyseFrontier(offers);

  assert.equal(analysis.degenerate, true);
  assert.equal(analysis.degenerateWinner, 'super');
  assert.deepEqual(analysis.frontier, ['super']);
  assert.equal(analysis.dominatedBy['mid'], 'super');
  assert.equal(analysis.dominatedBy['poor'], 'super');

  const warning = degeneracyWarning(analysis, offers);
  assert.ok(warning);
  assert.match(warning, /dominates all 2 other offers/);
  assert.match(warning, /generated wrongly/);
});

test('the guard stays quiet when a frontier has real shape', () => {
  // Three offers, each best at something. Nothing should be flagged, because a
  // guard that fires on healthy data gets switched off.
  const offers = [
    offer('cheapest', 860_000, 1334, '2026-08-31'),
    offer('most-cash', 934_000, 1373, '2026-08-28'),
    offer('slowest-but-rich', 940_000, 1390, '2026-09-05'),
  ];

  const analysis = analyseFrontier(offers);

  assert.equal(analysis.degenerate, false);
  assert.equal(degeneracyWarning(analysis, offers), null);
  assert.ok(analysis.frontier.length > 1);
});

test('a single offer is never degenerate', () => {
  // Nothing to dominate. Flagging here would fire on every opportunity that
  // attracted one bid, which is a normal state, not a broken one.
  const offers = [offer('only', 900_000, 1350, '2026-08-28')];
  const analysis = analyseFrontier(offers);

  assert.equal(analysis.degenerate, false);
  assert.deepEqual(analysis.frontier, ['only']);
});

test('dominated offers are named, so the UI can collapse them', () => {
  const offers = [
    offer('good', 950_000, 1300, '2026-08-28'),
    offer('strictly-worse', 900_000, 1400, '2026-09-02'),
    offer('trade-off', 800_000, 1200, '2026-08-28'),
  ];

  const analysis = analyseFrontier(offers);

  assert.equal(analysis.dominatedBy['strictly-worse'], 'good');
  // 'trade-off' is cheapest; it gives up cash for it, so it survives.
  assert.equal(analysis.dominatedBy['trade-off'], undefined);
  assert.equal(analysis.degenerate, false, 'two offers stand, so not degenerate');
});
