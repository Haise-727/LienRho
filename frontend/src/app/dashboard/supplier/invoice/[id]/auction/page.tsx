"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AuctionArena } from "@/components/auction/AuctionArena";
import { fetchOpportunities, Opportunity } from "@/lib/api-client";

export default function InvoiceAuctionArenaPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : undefined;

  // Null until resolved (#43).
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetchOpportunities();
      const found = res.opportunities.find(
        (o) => o.id === id || o.invoice?.id === id || o.invoice?.invoiceNumber === id
      );
      setOpp(found ?? null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading auction…</p>;
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

  return (
    <div className="max-w-4xl mx-auto py-2">
      <AuctionArena
        invoiceId={id ?? opp.id}
        opportunityId={opp.id}
        initialUrgencyBps={0}
        // Derived server-side and returned with the opportunity, so these are
        // this supplier's real gates rather than one hardcoded pair reused
        // across every invoice (#44).
        drivingObligation={opp.drivingObligation}
        sufficiencyFloor={opp.sufficiencyFloor}
      />
    </div>
  );
}
