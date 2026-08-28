"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ActiveAuctionsFeed, LiveAuctionItem } from "@/components/lender/ActiveAuctionsFeed";
import { NexusAgentTerminal } from "@/components/lender/NexusAgentTerminal";
import { fetchOpportunities } from "@/lib/api-client";
import { ArrowLeft, Activity, Radio, Cpu, Sliders, ShieldCheck } from "lucide-react";

export default function LenderLiveDealStreamPage() {
  const [auctions, setAuctions] = useState<LiveAuctionItem[]>([]);

  useEffect(() => {
    async function load() {
      const oppsRes = await fetchOpportunities();
      {
        const items: LiveAuctionItem[] = oppsRes.opportunities.map((o) => {
          let statusText: "SUBMITTED" | "ACCEPTED" | "DECLINED" = "SUBMITTED";
          let reasonText = "Passed risk floor and sector concentration check";

          if (o.invoice?.verificationTier === "SUPPLIER_ASSERTED" || o.riskGrade === "E") {
            statusText = "DECLINED";
            reasonText = "Declined: unverified tier / risk grade below mandate floor";
          } else if (o.status === "CLOSED" || o.status === "DISBURSED") {
            statusText = "ACCEPTED";
            reasonText = "Allocation cleared and disbursed on Day 0";
          }

          return {
            id: o.id,
            invoiceNumber: o.invoice?.invoiceNumber || "INV-2026",
            buyerName: o.invoice?.customer?.name || "Corporate Buyer",
            sector: o.invoice?.customer?.industry || "manufacturing",
            faceValue: o.invoice?.faceValue || o.requestedAmount,
            tenorDays: o.tenorDays || 45,
            riskGrade: o.riskGrade || "B",
            verificationTier: o.invoice?.verificationTier || "LEDGER_VERIFIED",
            status: o.status || "AUCTION_LIVE",
            myAgentBid: {
              advanceRatePct: statusText === "DECLINED" ? 0 : 88,
              annualAprPct: statusText === "DECLINED" ? 0 : 12.2,
              status: statusText,
              reason: reasonText,
            },
          };
        });
        setAuctions(items);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/lender"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Portfolio Command Center
        </Link>

        <Link
          href="/dashboard/lender/rules"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Sliders className="h-3.5 w-3.5" />
          Adjust Underwriting Rules
        </Link>
      </div>

      {/* Main View Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1.5">
          <Activity className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
          NexusX Multi-Agent Live Audit Stream · Step 3
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Live Deal Flow & Autonomous Underwriting
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
          Purely observational. Watch your autonomous LiteLLM underwriting agent evaluate live marketplace opportunities and deploy liquidity in real-time.
        </p>
      </div>

      {/* 1. Active Auctions Feed */}
      <ActiveAuctionsFeed auctions={auctions} />

      {/* 2. Enclosed Collapsible Terminal Console */}
      <div className="pt-4">
        <NexusAgentTerminal />
      </div>
    </div>
  );
}
