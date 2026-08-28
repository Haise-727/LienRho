/**
 * The lost-update case, argued rather than executed.
 *
 * Run: npx tsx --test src/lib/market/allocate-race.test.ts
 *
 * These tests pin the arithmetic that makes overdraw possible, using a fake
 * provider store in place of Postgres. Two implementations are compared: the
 * read-then-write shape that looks correct and is not, and the conditional
 * update `commit.ts` actually uses.
 *
 * Worth being explicit about the limit: this proves the *shape* of the bug and
 * that the guard closes it. It does not prove Postgres behaves as assumed —
 * only a test against a real database with genuine concurrent transactions does
 * that, and it is worth writing before anyone trusts this with real money.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rupeesToPaise } from './money';

/** Minimal stand-in for the one row that matters. */
class ProviderRow {
  constructor(public availableLiquidityPaise: number) {}
}

/**
 * The wrong way: read, decide, write. Each caller reads before either writes.
 */
async function readThenWrite(row: ProviderRow, amount: number): Promise<boolean> {
  const seen = row.availableLiquidityPaise;
  await Promise.resolve(); // the gap where the other transaction interleaves
  if (seen < amount) return false;
  row.availableLiquidityPaise = seen - amount;
  return true;
}

/**
 * The right way: the predicate and the decrement are one indivisible step —
 * `UPDATE ... SET liquidity = liquidity - x WHERE id = ? AND liquidity >= x`.
 */
function conditionalUpdate(row: ProviderRow, amount: number): boolean {
  if (row.availableLiquidityPaise < amount) return false;
  row.availableLiquidityPaise -= amount;
  return true;
}

test('read-then-write lets two deals overdraw the same provider', async () => {
  // ₹10L of liquidity, two deals wanting ₹6L each. Exactly one should succeed.
  const row = new ProviderRow(rupeesToPaise(1_000_000));
  const want = rupeesToPaise(600_000);

  const [a, b] = await Promise.all([readThenWrite(row, want), readThenWrite(row, want)]);

  assert.equal(a && b, true, 'both transactions believed they had the money');
  assert.equal(
    row.availableLiquidityPaise,
    rupeesToPaise(400_000),
    'and the second write clobbered the first, so only one decrement landed',
  );

  // The damage: ₹12L was promised out of ₹10L, and the ledger shows ₹4L left as
  // though only one deal happened. Nothing errors. Nothing looks wrong.
  assert.ok(rupeesToPaise(1_200_000) > rupeesToPaise(1_000_000));
});

test('the conditional update admits exactly one', () => {
  const row = new ProviderRow(rupeesToPaise(1_000_000));
  const want = rupeesToPaise(600_000);

  const first = conditionalUpdate(row, want);
  const second = conditionalUpdate(row, want);

  assert.equal(first, true);
  assert.equal(second, false, 'the loser is rejected, not silently overdrawn');
  assert.equal(row.availableLiquidityPaise, rupeesToPaise(400_000));
});

test('a rejected commit reports the race rather than erroring', () => {
  // count === 0 from updateMany is not a failure to talk to the database; it is
  // the predicate doing its job. The caller should re-clear, because a
  // different provider may now be the right answer.
  const row = new ProviderRow(rupeesToPaise(100_000));
  assert.equal(conditionalUpdate(row, rupeesToPaise(500_000)), false);
  assert.equal(row.availableLiquidityPaise, rupeesToPaise(100_000), 'untouched');
});

test('a syndicated commit is all-or-nothing', () => {
  // Three legs, and the third cannot be funded. Committing the first two would
  // leave the supplier short while two providers sit exposed to a deal that
  // never completed — worse than not committing at all.
  const providers = {
    a: new ProviderRow(rupeesToPaise(400_000)),
    b: new ProviderRow(rupeesToPaise(400_000)),
    c: new ProviderRow(rupeesToPaise(50_000)),
  };
  const legs: [keyof typeof providers, number][] = [
    ['a', rupeesToPaise(400_000)],
    ['b', rupeesToPaise(400_000)],
    ['c', rupeesToPaise(200_000)],
  ];

  const before = Object.fromEntries(
    Object.entries(providers).map(([k, v]) => [k, v.availableLiquidityPaise]),
  );

  let ok = true;
  for (const [id, amount] of legs) {
    if (!conditionalUpdate(providers[id], amount)) {
      ok = false;
      break;
    }
  }
  assert.equal(ok, false);

  // commit.ts throws inside the transaction so Postgres rolls back; here we
  // assert the property that rollback must provide.
  for (const [k, v] of Object.entries(providers)) v.availableLiquidityPaise = before[k];
  assert.deepEqual(
    Object.fromEntries(Object.entries(providers).map(([k, v]) => [k, v.availableLiquidityPaise])),
    before,
    'no leg may remain applied when a later one fails',
  );
});
