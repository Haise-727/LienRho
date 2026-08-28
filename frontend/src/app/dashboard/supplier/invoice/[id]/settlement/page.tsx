"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { SettlementView } from "@/components/ledger/SettlementView";
import { fetchOpportunities, Opportunity, FALLBACK_OPPORTUNITY } from "@/lib/api-client";

export default function InvoiceSettlementPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "inv-seed-001";

  const [opp, setOpp] = useState<Opportunity>(FALLBACK_OPPORTUNITY);

  useEffect(() => {
    async function load() {
      const res = await fetchOpportunities();
      const found = res.opportunities.find(
        (o) => o.id === id || o.invoice?.id === id || o.invoice?.invoiceNumber === id
      );
      if (found) {
        setOpp(found);
      }
    }
    load();
  }, [id]);

  const invoiceNumber = opp.invoice?.invoiceNumber || "INV-2026-0801";
  const buyerName = opp.invoice?.customer?.name || "Bharat Auto Ltd";
  const faceValue = opp.invoice?.faceValue || 1000000;

  return (
    <div className="py-2">
      <SettlementView
        invoiceId={id}
        invoiceNumber={invoiceNumber}
        buyerName={buyerName}
        providerName="Rapidfin"
        netCashPaise={93418836}
        faceValue={faceValue}
      />
    </div>
  );
}
