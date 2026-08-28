/**
 * Committing an allocation — the atomic half of matching.
 *
 * `clearOpportunity` decides who *should* fund and `allocate` checks whether
 * they *can*, but both are pure: they reason over a snapshot of provider
 * capacity that was read at some earlier moment. Between that read and the
 * write, another opportunity can draw down the same provider's liquidity.
 *
 * Nothing before this file prevents two suppliers being promised the same
 * rupees. This is where that is prevented.
 *
 * `03-system-design.md` Module 8 is explicit that the MVP answer is a Postgres
 * transaction rather than Redis: the check and the decrement have to be one
 * atomic step, and a distributed lock is a heavier way to get the same
 * guarantee at hackathon scale. Issue #2.
 */

import { prisma } from '@/lib/db';

import type { Allocation, Paise } from './types';

export interface CommitOutcome {
  committed: boolean;
  /** Allocations that were actually written. */
  allocations: Allocation[];
  /**
   * Providers whose capacity had moved between clearing and commit, so the
   * allocation they were offered could no longer be honoured.
   */
  raced: { providerId: string; wanted: Paise; available: Paise }[];
  reason: string;
}

/** Rupee string for a paise integer, for the Decimal columns. */
function paiseToDecimalString(paise: Paise): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Commit a cleared allocation, re-checking capacity inside the transaction.
 *
 * The whole design rests on one detail: the decrement is a **conditional
 * update**, not a read-then-write.
 *
 *     UPDATE capital_provider
 *        SET available_liquidity = available_liquidity - :amount
 *      WHERE id = :id AND available_liquidity >= :amount
 *
 * Postgres evaluates the predicate and applies the change in a single statement
 * under row locks, so two concurrent commits cannot both observe sufficient
 * liquidity and both succeed. A `findUnique` followed by an `update` would read
 * the same value in both transactions and cheerfully overdraw the provider —
 * and it would pass every test that does not run them concurrently, which is
 * exactly how this class of bug reaches production.
 *
 * `updateMany` returns a count, and a count of 0 means the predicate failed:
 * somebody else took the money first. That is not an error, it is the race
 * being detected, and the caller should re-clear rather than retry blindly —
 * a different provider may now be the right answer.
 */
export async function commitAllocation({
  opportunityId,
  allocations,
}: {
  opportunityId: string;
  allocations: Allocation[];
}): Promise<CommitOutcome> {
  if (allocations.length === 0) {
    return { committed: false, allocations: [], raced: [], reason: 'Nothing to commit' };
  }

  return prisma.$transaction(async (tx) => {
    const raced: CommitOutcome['raced'] = [];
    const applied: Allocation[] = [];

    for (const allocation of allocations) {
      const amount = paiseToDecimalString(allocation.fundedPaise);

      const { count } = await tx.capitalProvider.updateMany({
        where: {
          id: allocation.providerId,
          // The guard. Without it this is a lost-update waiting to happen.
          availableLiquidity: { gte: amount },
        },
        data: { availableLiquidity: { decrement: amount } },
      });

      if (count === 0) {
        const current = await tx.capitalProvider.findUnique({
          where: { id: allocation.providerId },
          select: { availableLiquidity: true },
        });
        raced.push({
          providerId: allocation.providerId,
          wanted: allocation.fundedPaise,
          available: current ? Number(current.availableLiquidity) * 100 : 0,
        });
        // Abort the whole allocation rather than funding it partially. A
        // syndicated deal that commits two legs of three leaves the supplier
        // short and two providers exposed to a deal that never completed;
        // throwing rolls back everything already applied in this transaction.
        throw new AllocationRaced(raced);
      }

      applied.push(allocation);
    }

    await tx.financingOpportunity.update({
      where: { id: opportunityId },
      data: { status: 'MATCHED' },
    });

    return {
      committed: true,
      allocations: applied,
      raced: [],
      reason:
        applied.length > 1
          ? `Committed across ${applied.length} providers`
          : 'Committed to a single provider',
    };
  }).catch((error: unknown) => {
    if (error instanceof AllocationRaced) {
      return {
        committed: false,
        allocations: [],
        raced: error.raced,
        reason:
          'Provider capacity changed while this deal was being cleared. ' +
          'Re-clear the opportunity — a different provider may now be the best available offer.',
      };
    }
    throw error;
  });
}

/** Internal signal that a conditional update lost its race. */
class AllocationRaced extends Error {
  constructor(readonly raced: CommitOutcome['raced']) {
    super('allocation raced');
    this.name = 'AllocationRaced';
  }
}
