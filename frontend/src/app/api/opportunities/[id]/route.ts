import { prisma } from "@/lib/db";
import { toJson, fail } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/opportunities/:id — one opportunity, with its bids and ledger trail. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const opportunity = await prisma.financingOpportunity.findUnique({
      where: { id },
      include: {
        invoice: { include: { customer: true } },
        // The raw cash facts Track 2's deriveSupplierUtility() reads. Shipped
        // with the opportunity so the derivation needs one round trip, not two.
        cashPosition: { include: { obligations: { orderBy: { dueDate: "asc" } } } },

        bids: {
          orderBy: [{ rank: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
          include: { provider: { select: { id: true, name: true, archetype: true, settlementDays: true, reliabilityScore: true } } },
        },
        match: { include: { provider: { select: { id: true, name: true, archetype: true } } } },
        escrowLocks: true,
        // The audit trail: every rupee that moved on this deal.
        journalEntries: {
          orderBy: { occurredAt: "asc" },
          include: { postings: { include: { account: { select: { code: true, name: true, type: true } } } } },
        },
      },
    });

    if (!opportunity) return fail(`No opportunity ${id}`, 404);
    return Response.json(toJson(opportunity));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to load opportunity");
  }
}
