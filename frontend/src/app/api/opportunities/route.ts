import { prisma } from "@/lib/db";
import { toJson, fail } from "@/lib/serialize";
import type { OpportunityStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/**
 * GET /api/opportunities            — every opportunity
 * GET /api/opportunities?status=AUCTION_LIVE
 *
 * The supplier-side market view. Bids are included in full: showing every
 * scored offer rather than only the winner is what makes the market visibly
 * real, and it is the same query either way (docs/05-decisions-needed.md §4).
 */
export async function GET(request: Request) {
  try {
    const status = new URL(request.url).searchParams.get("status");

    const opportunities = await prisma.financingOpportunity.findMany({
      where: status ? { status: status as OpportunityStatus } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        invoice: { include: { customer: true } },
        // The raw cash facts Track 2's deriveSupplierUtility() reads. Shipped
        // with the opportunity so the derivation needs one round trip, not two.
        cashPosition: { include: { obligations: { orderBy: { dueDate: "asc" } } } },

        bids: {
          orderBy: [{ rank: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
          include: { provider: { select: { id: true, name: true, archetype: true, settlementDays: true, reliabilityScore: true } } },
        },
        match: true,
      },
    });

    return Response.json({ count: opportunities.length, opportunities: toJson(opportunities) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to load opportunities");
  }
}
