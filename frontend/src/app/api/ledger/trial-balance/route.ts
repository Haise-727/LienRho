import { prisma } from "@/lib/db";
import { toJson, fail } from "@/lib/serialize";
import { trialBalance } from "@/lib/ledger/post";
import { DEBIT_NORMAL } from "@/lib/ledger/accounts";
import { money, sum, Decimal } from "@/lib/money";
import type { AccountType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/**
 * GET /api/ledger/trial-balance
 *
 * Every account's balance plus the system-wide check. If `balanced` is false
 * the ledger has lost money and nothing downstream of it can be trusted — so
 * this returns 500 rather than a cheerful 200 with a bad number in it.
 */
export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { code: "asc" },
      include: { postings: { select: { direction: true, amount: true } } },
    });

    const rows = accounts.map((account) => {
      const debits = sum(
        account.postings.filter((p) => p.direction === "DEBIT").map((p) => new Decimal(p.amount)),
      );
      const credits = sum(
        account.postings.filter((p) => p.direction === "CREDIT").map((p) => new Decimal(p.amount)),
      );
      const normalDebit = DEBIT_NORMAL.has(account.type as AccountType);
      return {
        code: account.code,
        name: account.name,
        type: account.type,
        debits: money(debits),
        credits: money(credits),
        // Positive means "as expected for this account type".
        balance: money(normalDebit ? debits.minus(credits) : credits.minus(debits)),
        postingCount: account.postings.length,
      };
    });

    const total = await trialBalance(prisma);

    return Response.json(
      toJson({ ...total, accountCount: rows.length, accounts: rows }),
      { status: total.balanced ? 200 : 500 },
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to compute trial balance");
  }
}
