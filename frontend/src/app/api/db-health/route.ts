import { prisma } from "@/lib/db";
import { trialBalance } from "@/lib/ledger/post";
import { fail } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * GET /api/db-health
 *
 * Is the shared database reachable, seeded, and does the ledger balance?
 * The three things a teammate actually wants to know before debugging their
 * own track. Named db-health rather than health so it does not collide with
 * the legacy FastAPI proxy route.
 */
export async function GET() {
  try {
    const [providers, opportunities, bids, entries] = await Promise.all([
      prisma.capitalProvider.count(),
      prisma.financingOpportunity.count(),
      prisma.bid.count(),
      prisma.journalEntry.count(),
    ]);
    const tb = await trialBalance(prisma);

    const seeded = providers > 0 && opportunities > 0;
    return Response.json(
      {
        status: seeded && tb.balanced ? "ok" : "degraded",
        seeded,
        ledgerBalanced: tb.balanced,
        counts: { providers, opportunities, bids, journalEntries: entries },
        hint: seeded ? undefined : "Run `npx tsx prisma/seed.ts` from frontend/.",
      },
      { status: seeded && tb.balanced ? 200 : 503 },
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Database unreachable", 503);
  }
}
