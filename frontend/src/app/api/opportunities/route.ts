import { prisma } from "@/lib/db";
import { toJson, fail } from "@/lib/serialize";
import type { OpportunityStatus } from "@/generated/prisma/enums";
import { deriveSupplierUtility } from "@/lib/market/utility";
import { today } from "@/lib/market/server";

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

    const asOf = today();

    // Derive the supplier's gates here rather than leaving callers to do it.
    //
    // `sufficiencyFloor` and `timingDeadline` are null in the database ON
    // PURPOSE — the gates come from the cash position at read time, which is
    // what makes "we infer need from the supplier's real position" true rather
    // than a value somebody wrote into a column (issue #7).
    //
    // The consequence for the UI was that every `opp.sufficiencyFloor ||
    // "900000.00"` fell through to its placeholder on every invoice, so one
    // hardcoded figure stood in for the whole book. Populating the columns in
    // the response fixes that everywhere at once, with no component change: the
    // fallbacks simply stop being reached.
    //
    // The alternative — a /api/match call per row — is an N+1 for data the
    // opportunity already carries.
    const enriched = opportunities.map((o) => {
      if (!o.cashPosition) return o;

      const utility = deriveSupplierUtility(
        {
          currentCashPaise: o.cashPosition.currentCashPaise,
          cashThresholdPaise: o.cashPosition.cashThresholdPaise,
          obligations: o.cashPosition.obligations.map((ob) => ({
            label: ob.label,
            amountPaise: ob.amountPaise,
            dueDate: ob.dueDate.toISOString().slice(0, 10),
          })),
        },
        asOf,
      );

      // A supplier with no projected shortfall genuinely has no floor. Writing
      // 0 would read as "needs nothing", which is right, while writing a
      // placeholder would read as a constraint that does not exist.
      return {
        ...o,
        sufficiencyFloor: (utility.sufficiencyFloorPaise / 100).toFixed(2),
        timingDeadline: utility.unconstrained ? null : new Date(`${utility.timingDeadline}T00:00:00Z`),
        drivingObligation: utility.drivingObligation,
        /** True when the supplier has no shortfall, so no gate binds. */
        unconstrained: utility.unconstrained,
      };
    });

    return Response.json({ count: enriched.length, opportunities: toJson(enriched) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to load opportunities");
  }
}
