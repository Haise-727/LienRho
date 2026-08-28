"use client";

import React, { useState, useEffect, useCallback } from "react";
import { VoiceVerificationModal } from "@/components/verification/VoiceVerificationModal";
import { useParams } from "next/navigation";
import { InvoiceHeader } from "@/components/supplier/InvoiceHeader";
import { ObjectiveConstraintsCard } from "@/components/supplier/ObjectiveConstraintsCard";
import { RunAuctionButton } from "@/components/supplier/RunAuctionButton";
import { fetchOpportunities, Opportunity, FALLBACK_OPPORTUNITY } from "@/lib/api-client";
import { formatINR } from "@/lib/scoring";

export default function InvoiceCashForecastFocusPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "inv-seed-001";

  const [opp, setOpp] = useState<Opportunity>(FALLBACK_OPPORTUNITY);
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
    if (found) {
      setOpp(found);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadOpp();
  }, [loadOpp]);

  const invoiceNumber = opp.invoice?.invoiceNumber || "INV-2026-0801";
  const buyerName = opp.invoice?.customer?.name || "Bharat Auto Ltd";
  const industry = opp.invoice?.customer?.industry || "Auto-Components";
  const faceValue = opp.invoice?.faceValue || 1000000;
  const tenorDays = opp.tenorDays || 45;
  const dueDate = opp.invoice?.dueDate 
    ? new Date(opp.invoice.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "07 Oct 2026";
  const status = opp.status || "AUCTION_LIVE";
  const verificationTier = opp.invoice?.verificationTier || "BUYER_ACCEPTED";

  const sufficiencyFloor = opp.sufficiencyFloor || "900000.00";
  const timingDeadline = opp.timingDeadline 
    ? new Date(opp.timingDeadline).toISOString().split("T")[0]
    : "2026-08-30";
  const drivingObligation = opp.drivingObligation || "September payroll";

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
