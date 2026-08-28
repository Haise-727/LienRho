// The posting engine. Everything that moves money goes through `postEntry`.
//
// One invariant, enforced here rather than trusted: the postings of a journal
// entry sum to zero — total debits equal total credits. It is checked before
// the write and inside the same transaction as the write, so an unbalanced
// entry cannot reach the table even under a concurrent writer.
//
// Entries are immutable. A correction is a new reversing entry, never an edit,
// because in this product the trail *is* the deliverable.

import { prisma } from "@/lib/db";
import { money, sum, ZERO, Decimal, type DecimalValue } from "@/lib/money";
import { DEBIT_NORMAL } from "./accounts";
import type { LedgerEventType, PostingDirection, AccountType } from "@/generated/prisma/enums";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export class UnbalancedEntryError extends Error {
  constructor(reference: string, debits: Decimal, credits: Decimal) {
    super(
      `Journal entry ${reference} does not balance: ` +
        `debits ${debits.toFixed(2)} vs credits ${credits.toFixed(2)} ` +
        `(difference ${debits.minus(credits).toFixed(2)}).`,
    );
    this.name = "UnbalancedEntryError";
  }
}

export interface PostingInput {
  /** Account code, e.g. `provider:aurora:cash`. */
  account: string;
  direction: PostingDirection;
  amount: DecimalValue;
}

export interface EntryInput {
  /** Idempotency key. Re-posting the same reference is a no-op, not a double count. */
  reference: string;
  eventType: LedgerEventType;
  description: string;
  opportunityId?: string | null;
  occurredAt?: Date;
  metadata?: Prisma.InputJsonValue;
  postings: PostingInput[];
}

export function debit(account: string, amount: DecimalValue): PostingInput {
  return { account, direction: "DEBIT", amount };
}

export function credit(account: string, amount: DecimalValue): PostingInput {
  return { account, direction: "CREDIT", amount };
}

/** Total debits and total credits, at 2dp. */
export function totals(postings: PostingInput[]) {
  const debits = sum(
    postings.filter((p) => p.direction === "DEBIT").map((p) => money(p.amount)),
  );
  const credits = sum(
    postings.filter((p) => p.direction === "CREDIT").map((p) => money(p.amount)),
  );
  return { debits, credits };
}

export function isBalanced(postings: PostingInput[]): boolean {
  const { debits, credits } = totals(postings);
  return debits.equals(credits);
}

/**
 * Write one balanced journal entry.
 *
 * Returns the existing entry untouched if `reference` has already been posted:
 * a retried disbursement must not post twice, which is the "without
 * double-counting" requirement, and the unique index makes it the database's
 * job rather than the caller's.
 */
export async function postEntry(input: EntryInput, db: Db = prisma) {
  if (input.postings.length < 2) {
    throw new Error(
      `Journal entry ${input.reference} has ${input.postings.length} posting(s); ` +
        `double-entry needs at least two.`,
    );
  }

  for (const p of input.postings) {
    if (money(p.amount).lessThanOrEqualTo(ZERO)) {
      throw new Error(
        `Posting to ${p.account} in ${input.reference} has non-positive amount ` +
          `${money(p.amount).toFixed(2)}. Amounts are always positive; ` +
          `direction carries the sign.`,
      );
    }
  }

  const { debits, credits } = totals(input.postings);
  if (!debits.equals(credits)) {
    throw new UnbalancedEntryError(input.reference, debits, credits);
  }

  const run = async (tx: Db) => {
    const existing = await tx.journalEntry.findUnique({
      where: { reference: input.reference },
      include: { postings: true },
    });
    if (existing) return existing;

    const codes = [...new Set(input.postings.map((p) => p.account))];
    const accounts = await tx.account.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    const byCode = new Map(accounts.map((a) => [a.code, a.id]));

    const missing = codes.filter((c) => !byCode.has(c));
    if (missing.length) {
      throw new Error(
        `Unknown account code(s) in ${input.reference}: ${missing.join(", ")}. ` +
          `Create them with ensureAccounts() before posting.`,
      );
    }

    return tx.journalEntry.create({
      data: {
        reference: input.reference,
        eventType: input.eventType,
        description: input.description,
        opportunityId: input.opportunityId ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        metadata: input.metadata,
        postings: {
          create: input.postings.map((p) => ({
            accountId: byCode.get(p.account)!,
            direction: p.direction,
            amount: money(p.amount),
          })),
        },
      },
      include: { postings: true },
    });
  };

  // Only open a transaction if we are not already inside one.
  return "$transaction" in db ? (db as PrismaClient).$transaction(run) : run(db);
}

/**
 * An account's balance in its own normal direction, so an asset with money in
 * it reads positive and so does a liability that is owed.
 */
export async function accountBalance(code: string, db: Db = prisma): Promise<Decimal> {
  const account = await db.account.findUnique({
    where: { code },
    include: { postings: { select: { direction: true, amount: true } } },
  });
  if (!account) throw new Error(`No such account: ${code}`);

  const debits = sum(
    account.postings.filter((p) => p.direction === "DEBIT").map((p) => new Decimal(p.amount)),
  );
  const credits = sum(
    account.postings.filter((p) => p.direction === "CREDIT").map((p) => new Decimal(p.amount)),
  );

  return DEBIT_NORMAL.has(account.type as AccountType)
    ? money(debits.minus(credits))
    : money(credits.minus(debits));
}

/**
 * Every posting ever written, netted. Must be exactly zero.
 *
 * Cheap enough to assert after seeding and after the demo's settlement run —
 * if this is non-zero the ledger has lost money and nothing downstream of it
 * can be trusted.
 */
export async function trialBalance(db: Db = prisma) {
  const grouped = await db.posting.groupBy({
    by: ["direction"],
    _sum: { amount: true },
  });
  const pick = (d: PostingDirection) =>
    new Decimal(grouped.find((g) => g.direction === d)?._sum.amount ?? 0);

  const debits = money(pick("DEBIT"));
  const credits = money(pick("CREDIT"));
  return { debits, credits, balanced: debits.equals(credits) };
}
