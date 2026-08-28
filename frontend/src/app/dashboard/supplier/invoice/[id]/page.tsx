"use client";

import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    async function loadOpp() {
      setLoading(true);
      const res = await fetchOpportunities();
      const found = res.opportunities.find(
        (o) => o.id === id || o.invoice?.id === id || o.invoice?.invoiceNumber === id
      );
      if (found) {
        setOpp(found);
      }
      setLoading(false);
    }
    loadOpp();
  }, [id]);

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

      {/* 3. Prominent Cobalt Blue CTA: View Market Offers */}
      <RunAuctionButton invoiceId={id} />
    </div>
  );
}
