// Outbound verification call (#3, #29).
//
// What this does commercially: an invoice can be financed on three strengths
// of claim, and the jump from SUPPLIER_ASSERTED to BUYER_ACCEPTED is the
// single biggest lever on price in receivables finance. Once the buyer has
// formally acknowledged the debt, the provider is taking the *buyer's* credit
// risk rather than the supplier's — usually a much stronger credit, so the
// money gets cheaper (docs/01-commerce-analysis.md §1).
//
// This route is the mechanism for that jump: place the call, and on
// confirmation upgrade the tier.
//
// Simulated, and labelled as such in the spoken words themselves. No telephony
// is involved and no real buyer is contacted. A recorded voice implying
// otherwise would be a lie told in audio, and the market is already simulated.
//
// The division of labour matters: the *voice* narrates, the *upgrade* is a
// deterministic database write. No model decides that a business is verified —
// same rule as the ledger, applied to verification.

import { prisma } from "@/lib/db";
import { verificationCallScript } from "@/lib/voice/script";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rupees(value: unknown): string {
  const n = Number(value ?? 0);
  const s = n.toFixed(2);
  const [whole, frac] = s.split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `${grouped}.${frac}`;
}

/** GET — the script for this invoice, so the UI can play it line by line. */
export async function GET(request: Request) {
  const invoiceId = new URL(request.url).searchParams.get("invoiceId");
  if (!invoiceId) {
    return Response.json({ error: "invoiceId is required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: { select: { name: true } } },
  });
  if (!invoice) return Response.json({ error: "No such invoice" }, { status: 404 });

  return Response.json({
    invoiceNumber: invoice.invoiceNumber,
    buyerName: invoice.customer.name,
    currentTier: invoice.verificationTier,
    alreadyAccepted: invoice.verificationTier === "BUYER_ACCEPTED",
    // The facts the dialog displays. Sent from here so the panel and the
    // spoken transcript cannot disagree about which invoice this is.
    facts: {
      invoiceNumber: invoice.invoiceNumber,
      buyerName: invoice.customer.name,
      faceValue: rupees(invoice.faceValue),
      threeWayMatched: invoice.threeWayMatched,
    },
    lines: verificationCallScript({
      buyerName: invoice.customer.name,
      invoiceNumber: invoice.invoiceNumber,
      faceValueRupees: rupees(invoice.faceValue),
    }),
  });
}

/** POST — the buyer confirmed. Upgrade the tier. */
export async function POST(request: Request) {
  let invoiceId: string;
  try {
    const body = await request.json();
    invoiceId = String(body?.invoiceId ?? "");
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!invoiceId) return Response.json({ error: "invoiceId is required" }, { status: 400 });

  try {
    // Read and write in one transaction. Two calls landing together must not
    // both decide the tier was un-upgraded and both write — the same
    // discipline the ledger uses, for the same reason.
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, verificationTier: true, acceptanceDate: true },
      });
      if (!invoice) return { status: 404 as const };

      // Idempotent: calling twice is a no-op rather than a second "upgrade".
      if (invoice.verificationTier === "BUYER_ACCEPTED") {
        return { status: 200 as const, alreadyAccepted: true, invoice };
      }

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          verificationTier: "BUYER_ACCEPTED",
          // The schema's own marker for a formal acknowledgement. Setting the
          // tier without it would leave the row saying the buyer accepted
          // while carrying no record of when.
          acceptanceDate: invoice.acceptanceDate ?? new Date(),
        },
        select: { verificationTier: true, acceptanceDate: true },
      });

      return { status: 200 as const, alreadyAccepted: false, updated };
    });

    if (result.status === 404) {
      return Response.json({ error: "No such invoice" }, { status: 404 });
    }

    return Response.json({
      ok: true,
      alreadyAccepted: result.alreadyAccepted,
      verificationTier: "BUYER_ACCEPTED",
      // Say what changed commercially, not just what changed in the row.
      effect: result.alreadyAccepted
        ? "This invoice was already buyer-accepted; nothing changed."
        : "Verification tier upgraded to buyer-accepted. Providers now price " +
          "this against the buyer's credit rather than the supplier's, so " +
          "re-running the auction should produce better terms.",
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 500 },
    );
  }
}
