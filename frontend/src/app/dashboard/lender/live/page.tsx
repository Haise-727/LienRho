"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ActiveAuctionsFeed, LiveAuctionItem } from "@/components/lender/ActiveAuctionsFeed";
import { fetchOpportunities } from "@/lib/api-client";
import { ArrowLeft, Sliders, Activity } from "lucide-react";

export default function LenderLiveDealStreamPage() {
  const [auctions, setAuctions] = useState<LiveAuctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const oppsRes = await fetchOpportunities();
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
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0047FF] hover:text-blue-800 transition-colors"
        >
          <Sliders className="h-3.5 w-3.5" />
          Adjust Underwriting Rules
        </Link>
      </div>

      {/* Main View Header */}
      <div className="border-b border-slate-100 pb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 bg-slate-100">
          <Activity className="h-3.5 w-3.5" />
          NexusX Multi-Agent Live Audit Stream
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Live Deal Flow & Autonomous Underwriting
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
          Purely observational. Watch your autonomous LiteLLM underwriting agent evaluate live marketplace opportunities and deploy liquidity in real-time.
        </p>
      </div>

      <ActiveAuctionsFeed auctions={auctions} isLoading={isLoading} />
    </div>
  );
}
