/**
 * Allocation tests.
 *
 * Run: npx tsx --test src/lib/market/allocate.test.ts
 *
 * Allocation is where a ranking meets reality: the provider that should win may
 * no longer be able to fund. These tests pin the cases where that changes the
 * outcome, because getting them wrong means either promising a supplier money
 * that does not exist, or refusing a deal that could have been syndicated.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allocate, explainAllocation } from './allocate';
import type { ProviderCapacity } from './allocate';
import { rupeesToPaise } from './money';
import type { Offer, ScoredOffer } from './types';

function survivor(id: string, rank: number): ScoredOffer {
  const stub: Offer = {
    id: `bid-${id}`,
    opportunityId: 'opp-1',
    providerId: id,
    advanceRateBps: 9500,
    annualRateBps: 1350,
    feesPaise: 0,
    tenorDays: 45,
    settlementDays: 0,
    recourse: 'WITH_RECOURSE',
    expiresAt: '2026-12-31',
  };
  return {
    offer: stub,
    providerName: `Provider ${id}`,
    advancePaise: rupeesToPaise(950_000),
    discountChargePaise: 0,
    netCashPaise: rupeesToPaise(934_188),
    effectiveCostBps: 1373,
    arrivalDate: '2026-08-28',
    gates: {
      sufficiency: { passed: true, reason: '' },
      timing: { passed: true, reason: '' },
    },
    disqualified: false,
    rank,
    dominatedBy: null,
  };
}

function capacity(
  providerId: string,
  liquidityRupees: number,
  opts: Partial<ProviderCapacity> = {},
): ProviderCapacity {
  return {
    providerId,
    availableLiquidityPaise: rupeesToPaise(liquidityRupees),
    minTicketPaise: rupeesToPaise(50_000),
    maxTicketPaise: rupeesToPaise(10_000_000),
    buyerHeadroomPaise: rupeesToPaise(10_000_000),
    ...opts,
  };
}

const TARGET = rupeesToPaise(950_000);

test('the top-ranked provider funds the whole advance when it can', () => {
  const outcome = allocate({
    survivors: [survivor('A', 1), survivor('B', 2)],
    targetPaise: TARGET,
    capacities: { A: capacity('A', 5_000_000), B: capacity('B', 5_000_000) },
  });

  assert.equal(outcome.allocations.length, 1);
  assert.equal(outcome.allocations[0].providerId, 'A');
  assert.equal(outcome.allocations[0].fundedPaise, TARGET);
  assert.equal(outcome.shortfallPaise, 0);
  assert.equal(outcome.syndicated, false);
  assert.equal(
    outcome.allocations[0].providerLiquidityAfterPaise,
    rupeesToPaise(5_000_000) - TARGET,
  );
});

test('a fill is split when no single provider has the headroom', () => {
  // The supplier needs ₹9.5L. Nobody has it alone; together they do. Refusing
  // to syndicate would turn a fundable deal into NO_ACCEPTABLE_OFFER for a
  // reason that has nothing to do with the supplier.
  const outcome = allocate({
    survivors: [survivor('A', 1), survivor('B', 2), survivor('C', 3)],
    targetPaise: TARGET,
    capacities: {
      A: capacity('A', 400_000),
      B: capacity('B', 400_000),
      C: capacity('C', 400_000),
    },
  });

  assert.equal(outcome.shortfallPaise, 0);
  assert.equal(outcome.syndicated, true);
  assert.equal(outcome.allocations.length, 3);
  // Ranked order is preserved — the best offer takes the largest bite first.
  assert.deepEqual(
    outcome.allocations.map((a) => a.providerId),
    ['A', 'B', 'C'],
  );
  const funded = outcome.allocations.reduce((n, a) => n + a.fundedPaise, 0);
  assert.equal(funded, TARGET);
});

test('a provider below its own minimum ticket takes nothing', () => {
  // Minimum tickets exist because small deals cost more to administer than they
  // earn. Quietly breaching one to close a fill would make the simulation
  // dishonest about the constraint it claims to model.
  const outcome = allocate({
    survivors: [survivor('A', 1), survivor('B', 2)],
    targetPaise: TARGET,
    capacities: {
      A: capacity('A', 900_000),
      // Only ₹50k of the fill would remain for B, below its ₹1L floor.
      B: capacity('B', 5_000_000, { minTicketPaise: rupeesToPaise(100_000) }),
    },
  });

  assert.equal(outcome.allocations.length, 1);
  assert.equal(outcome.allocations[0].providerId, 'A');
  assert.ok(outcome.shortfallPaise > 0);
  assert.deepEqual(
    outcome.skipped.map((s) => s.reason),
    ['BELOW_MIN_TICKET'],
  );
});

test('buyer concentration caps a provider even with liquidity to spare', () => {
  // Concentration is per-buyer: a provider already loaded with this buyer's
  // paper should not take more, however much cash it is holding.
  const outcome = allocate({
    survivors: [survivor('A', 1), survivor('B', 2)],
    targetPaise: TARGET,
    capacities: {
      A: capacity('A', 50_000_000, { buyerHeadroomPaise: 0 }),
      B: capacity('B', 5_000_000),
    },
  });

  assert.deepEqual(
    outcome.skipped.map((s) => [s.providerId, s.reason]),
    [['A', 'BUYER_CONCENTRATION']],
  );
  assert.equal(outcome.allocations[0].providerId, 'B');
  assert.equal(outcome.shortfallPaise, 0);
});

test('headroom limits the size of a bite without excluding the provider', () => {
  const outcome = allocate({
    survivors: [survivor('A', 1), survivor('B', 2)],
    targetPaise: TARGET,
    capacities: {
      A: capacity('A', 5_000_000, { buyerHeadroomPaise: rupeesToPaise(500_000) }),
      B: capacity('B', 5_000_000),
    },
  });

  assert.equal(outcome.allocations[0].fundedPaise, rupeesToPaise(500_000));
  assert.equal(outcome.allocations[1].providerId, 'B');
  assert.equal(outcome.shortfallPaise, 0);
  assert.equal(outcome.syndicated, true);
});

test('no capacity anywhere is reported distinctly from a bad offer set', () => {
  const outcome = allocate({
    survivors: [survivor('A', 1)],
    targetPaise: TARGET,
    capacities: { A: capacity('A', 0) },
  });

  assert.equal(outcome.allocations.length, 0);
  assert.equal(outcome.shortfallPaise, TARGET);
  assert.equal(
    explainAllocation(outcome, TARGET),
    'No provider that cleared the gates had capacity to fund this',
  );
});

test('a partial fill says how much was covered', () => {
  const outcome = allocate({
    survivors: [survivor('A', 1)],
    targetPaise: TARGET,
    capacities: { A: capacity('A', 475_000) },
  });

  assert.ok(outcome.shortfallPaise > 0);
  assert.match(explainAllocation(outcome, TARGET), /Only 50% could be funded/);
});
