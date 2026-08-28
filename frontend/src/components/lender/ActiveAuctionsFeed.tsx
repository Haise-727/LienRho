"use client";

import React from "react";
import { Building2, Calendar, CheckCircle2, ShieldCheck, Zap, Activity, Clock } from "lucide-react";
import { formatINR } from "@/lib/scoring";

export interface LiveAuctionItem {
  id: string;
  invoiceNumber: string;
  buyerName: string;
  sector: string;
  faceValue: number | string;
  tenorDays: number;
  riskGrade: string;
  verificationTier: string;
  status: string;
  myAgentBid?: {
    advanceRatePct: number;
    annualAprPct: number;
    status: "SUBMITTED" | "ACCEPTED" | "EVALUATING" | "DECLINED";
    reason?: string;
  };
}

const DEFAULT_LIVE_AUCTIONS: LiveAuctionItem[] = [
  {
    id: "opp-seed-001",
    invoiceNumber: "INV-2026-0801",
    buyerName: "Bharat Auto Ltd",
    sector: "auto-components",
    faceValue: "1000000.00",
    tenorDays: 45,
    riskGrade: "A",
    verificationTier: "BUYER_ACCEPTED",
    status: "AUCTION_LIVE",
    myAgentBid: {
      advanceRatePct: 88,
      annualAprPct: 12.2,
      status: "SUBMITTED",
      reason: "Passed risk floor A and sector capacity check (80%)",
    },
  },
  {
    id: "opp-seed-002",
    invoiceNumber: "INV-2026-0802",
    buyerName: "Sundaram Textiles Ltd",
    sector: "textiles",
    faceValue: "450000.00",
    tenorDays: 60,
    riskGrade: "C",
    verificationTier: "LEDGER_VERIFIED",
    status: "AUCTION_LIVE",
    myAgentBid: {
      advanceRatePct: 90,
      annualAprPct: 12.8,
      status: "ACCEPTED",
      reason: "Winning allocation selected on Day 0",
    },
  },
  {
    id: "opp-seed-003",
    invoiceNumber: "INV-2026-0803",
    buyerName: "Orion Retail Pvt Ltd",
    sector: "retail",
    faceValue: "2200000.00",
    tenorDays: 30,
    riskGrade: "E",
    verificationTier: "SUPPLIER_ASSERTED",
    status: "AUCTION_LIVE",
    myAgentBid: {
      advanceRatePct: 0,
      annualAprPct: 0,
      status: "DECLINED",
      reason: "Fails risk floor B and unverified tier",
    },
  },
];

interface ActiveAuctionsFeedProps {
  auctions?: LiveAuctionItem[];
}

export function ActiveAuctionsFeed({ auctions = DEFAULT_LIVE_AUCTIONS }: ActiveAuctionsFeedProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Marketplace Deal Stream
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Active auctions in the clearinghouse. Your autonomous agent continuously evaluates opportunities against your saved underwriting parameters.
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200 font-mono">
          {auctions.length} Invoices In Market
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {auctions.map((item) => {
          const isSubmitted = item.myAgentBid?.status === "SUBMITTED";
          const isAccepted = item.myAgentBid?.status === "ACCEPTED";
          const isDeclined = item.myAgentBid?.status === "DECLINED";

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs transition duration-150 hover:shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-slate-900 text-lg">
                      {item.invoiceNumber}
                    </span>
                    <span className="rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-2 py-0.5 font-mono">
                      {item.status}
                    </span>
                    <span className="rounded bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 border border-slate-200">
                      Grade {item.riskGrade}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      {item.buyerName}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="capitalize">{item.sector}</span>
                    <span className="text-slate-300">•</span>
                    <span>{item.tenorDays}d Tenor</span>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Face Value
                  </span>
                  <span className="text-xl font-bold font-mono text-slate-900 block">
                    {formatINR(item.faceValue)}
                  </span>
                </div>
              </div>

              {/* Autonomous Agent Decision Box */}
              <div className={`rounded-xl p-4 border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isAccepted
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                  : isSubmitted
                  ? "bg-blue-50/70 border-blue-200 text-blue-900"
                  : "bg-slate-50 border-slate-200 text-slate-600"
              }`}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      [Autonomous LiteLLM Agent]
                    </span>
                    <span className={`rounded px-2 py-0.2 text-[10px] font-bold uppercase ${
                      isAccepted
                        ? "bg-emerald-200 text-emerald-900"
                        : isSubmitted
                        ? "bg-blue-200 text-blue-900"
                        : "bg-slate-200 text-slate-700"
                    }`}>
                      {item.myAgentBid?.status}
                    </span>
                  </div>
                  <p className="text-xs opacity-90">
                    {item.myAgentBid?.reason}
                  </p>
                </div>

                {item.myAgentBid && item.myAgentBid.advanceRatePct > 0 && (
                  <div className="flex items-center gap-3 font-mono self-start sm:self-center">
                    <div className="text-right">
                      <span className="text-[10px] block opacity-75 font-sans">Advance</span>
                      <span className="font-bold">{item.myAgentBid.advanceRatePct}%</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] block opacity-75 font-sans">Rate</span>
                      <span className="font-bold">{item.myAgentBid.annualAprPct}% APR</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
