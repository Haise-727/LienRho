import { prisma } from "@/lib/db";
import { toJson, fail } from "@/lib/serialize";
import { totals } from "@/lib/ledger/post";
import type { LedgerEventType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/ledger/entries
 *   ?opportunityId=<id>   entries for one deal
 *   ?eventType=DISBURSEMENT
 *   ?limit=50
 *
 * Every entry carries its own debit/credit totals so the Stitch visualiser can
 * show that each one balances without re-deriving it client-side.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const limit = Math.min(Number(params.get("limit") ?? 50) || 50, 200);

    const entries = await prisma.journalEntry.findMany({
      where: {
        opportunityId: params.get("opportunityId") ?? undefined,
        eventType: (params.get("eventType") as LedgerEventType | null) ?? undefined,
      },
      orderBy: { occurredAt: "desc" },
      take: limit,
      include: {
        postings: { include: { account: { select: { code: true, name: true, type: true } } } },
      },
    });

    const withTotals = entries.map((entry) => {
      const { debits, credits } = totals(
        entry.postings.map((p) => ({
          account: p.account.code,
          direction: p.direction,
          amount: new Prisma.Decimal(p.amount),
        })),
      );
      return {
        ...entry,
        totals: { debits, credits, balanced: debits.equals(credits) },
      };
    });

    return Response.json({ count: withTotals.length, entries: toJson(withTotals) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to load ledger entries");
  }
}
