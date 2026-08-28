"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AuctionArena } from "@/components/auction/AuctionArena";
import { fetchOpportunities, Opportunity, FALLBACK_OPPORTUNITY } from "@/lib/api-client";

export default function InvoiceAuctionArenaPage() {
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

  return (
    <div className="max-w-4xl mx-auto py-2">
      <AuctionArena
        invoiceId={id}
        opportunityId={opp.id || "opp-seed-001"}
        initialUrgencyBps={0}
        drivingObligation={opp.drivingObligation || "September payroll"}
        sufficiencyFloor={opp.sufficiencyFloor || "900000.00"}
      />
    </div>
  );
}
