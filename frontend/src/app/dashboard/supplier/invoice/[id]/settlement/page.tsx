"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { SettlementView } from "@/components/ledger/SettlementView";
import { fetchOpportunities, matchOpportunity, Opportunity } from "@/lib/api-client";

/**
 * Settlement for one invoice.
 *
 * Every figure here used to be a literal: providerName "Rapidfin", netCashPaise
 * 93418836, and the ledger drawer pinned to "opp-seed-001". So all three
 * invoices rendered the same deal and the same journal — in the one screen whose
 * entire purpose is showing that each rupee traces to a recorded entry (#45).
 *
 * The winner and the net cash now come from the clearing engine, and the ledger
 * from the opportunity actually being viewed.
 */
export default function InvoiceSettlementPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : undefined;

  // Null until resolved, rather than a fabricated opportunity. An unresolvable
  // id must not render a complete, plausible invoice belonging to nobody (#43).
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [winner, setWinner] = useState<{ name: string; netCashPaise: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setLoading(false);
        return;
      }
      const res = await fetchOpportunities();
      const found = res.opportunities.find(
        (o) => o.id === id || o.invoice?.id === id || o.invoice?.invoiceNumber === id
      );
      if (cancelled) return;
      setOpp(found ?? null);

      if (found) {
        // The winner is whatever cleared, not a name typed into the page.
        const match = await matchOpportunity(found.id);
        if (cancelled) return;
        if (match?.status === "MATCHED") {
          const top = match.scoredOffers.find((o) => o.rank === 1);
          if (top) setWinner({ name: top.providerName, netCashPaise: top.netCashPaise });
        }
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading settlement…</p>;
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
    <div className="py-2">
      <SettlementView
        invoiceId={id ?? opp.id}
        opportunityId={opp.id}
        invoiceNumber={opp.invoice?.invoiceNumber}
        buyerName={opp.invoice?.customer?.name}
        faceValue={opp.invoice?.faceValue}
        // Undefined rather than a stand-in when nothing has cleared yet — the
        // component's own empty rendering is honest, an invented winner is not.
        providerName={winner?.name}
        netCashPaise={winner?.netCashPaise}
      />
    </div>
  );
}
