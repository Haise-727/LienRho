"use client";

import React, { useState, useEffect, useCallback } from "react";
import { VoiceVerificationModal } from "@/components/verification/VoiceVerificationModal";
import { useParams } from "next/navigation";
import { InvoiceHeader } from "@/components/supplier/InvoiceHeader";
import { ObjectiveConstraintsCard } from "@/components/supplier/ObjectiveConstraintsCard";
import { RunAuctionButton } from "@/components/supplier/RunAuctionButton";
import { fetchOpportunities, Opportunity } from "@/lib/api-client";
import { formatINR } from "@/lib/scoring";

export default function InvoiceCashForecastFocusPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : undefined;

  // Null until resolved. Seeding from FALLBACK_OPPORTUNITY meant an
  // unresolvable id rendered a complete, plausible invoice — buyer, amount,
  // obligations, bids — with nothing marking it fictional (#43).
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [callOpen, setCallOpen] = useState(false);

  // Lifted out of the effect so the verification call can re-run it once the
  // tier upgrade commits — otherwise the badge on this page keeps showing the
  // old tier until a manual reload, which reads as the upgrade having failed.
  const loadOpp = useCallback(async () => {
    setLoading(true);
    const res = await fetchOpportunities();
    const found = res.opportunities.find(
      (o) => o.id === id || o.invoice?.id === id || o.invoice?.invoiceNumber === id
    );
    // `found ?? null`, not `if (found)`. Keeping the previous opportunity when
    // the id no longer resolves is what made the placeholder sticky rather than
    // momentary (#43) — and after a tier upgrade re-read it would silently show
    // stale data as though the refresh had succeeded.
    setOpp(found ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadOpp();
  }, [loadOpp]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading invoice…</p>;
  }

  if (!opp) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-semibold text-slate-900">Invoice not found</p>
        <p className="mt-1 text-xs text-slate-500">
          No opportunity matches {id ?? "this address"}.
        </p>
      </div>
    );
  }

  const invoiceNumber = opp.invoice?.invoiceNumber ?? "—";
  const buyerName = opp.invoice?.customer?.name ?? "—";
  const industry = opp.invoice?.customer?.industry ?? "—";
  const faceValue = opp.invoice?.faceValue ?? 0;
  const tenorDays = opp.tenorDays;
  const dueDate = opp.invoice?.dueDate
    ? new Date(opp.invoice.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const status = opp.status;
  const verificationTier = opp.invoice?.verificationTier ?? "SUPPLIER_ASSERTED";

  // Derived server-side from the cash position and returned by
  // /api/opportunities, so these no longer fall through to a hardcoded
  // ₹9,00,000 and "September payroll" on every invoice (#44).
  const sufficiencyFloor = opp.sufficiencyFloor ?? null;
  const timingDeadline = opp.timingDeadline
    ? new Date(opp.timingDeadline).toISOString().split("T")[0]
    : null;
  const drivingObligation = opp.drivingObligation ?? null;

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      {/* 1. Header with invoice facts */}
      <InvoiceHeader
        invoiceNumber={invoiceNumber}
        buyerName={buyerName}
        industry={industry}
        faceValue={faceValue}
        tenorDays={tenorDays}
        dueDate={dueDate}
        status={status}
        verificationTier={verificationTier}
      />

      {/* 2. Objective Constraints Card (The Lexicographic Gates) */}
      <ObjectiveConstraintsCard
        sufficiencyFloor={sufficiencyFloor}
        timingDeadline={timingDeadline}
        drivingObligation={drivingObligation}
      />

      {/* 3. Verification call.
          Offered only when the tier can actually move. On a buyer-accepted
          invoice the button would do nothing, and a control that does nothing
          teaches people to distrust the ones that do. */}
      {verificationTier !== "BUYER_ACCEPTED" && opp.invoice?.id && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                This invoice is not buyer-accepted
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Providers are pricing it against{" "}
                <span className="font-medium">Vertex&apos;s</span> credit and the risk
                that the buyer disputes it. A confirmation from{" "}
                <span className="font-medium">{buyerName}</span> moves that risk onto
                the buyer&apos;s balance sheet, which is materially cheaper.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCallOpen(true)}
              className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              Verify by call
            </button>
          </div>
        </div>
      )}

      <VoiceVerificationModal
        isOpen={callOpen}
        onClose={() => setCallOpen(false)}
        invoiceId={opp.invoice?.id ?? ""}
        onVerified={() => {
          // Refetch rather than patch local state: the tier is one of several
          // things the upgrade changes, and re-reading is how the page and the
          // database stay in agreement.
          void loadOpp();
        }}
      />

      {/* 4. Prominent Cobalt Blue CTA: View Market Offers */}
      <RunAuctionButton invoiceId={id} />
    </div>
  );
}
