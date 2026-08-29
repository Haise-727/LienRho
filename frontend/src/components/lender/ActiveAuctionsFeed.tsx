"use client";

import React from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
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

interface ActiveAuctionsFeedProps {
  auctions?: LiveAuctionItem[];
  isLoading?: boolean;
}

export function ActiveAuctionsFeed({ auctions = [], isLoading = false }: ActiveAuctionsFeedProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#0047FF] animate-pulse" />
            Live Deal Stream
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time auction flow. Your autonomous agent evaluates these opportunities instantly.
          </p>
        </div>

        {!isLoading && (
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
            {auctions.length} Active Deals
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          // Skeleton Loaders
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-50 border border-slate-100 p-6 space-y-4">
              <div className="h-5 bg-slate-200 rounded w-1/3"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              <div className="h-10 bg-slate-200 rounded w-full mt-4"></div>
            </div>
          ))
        ) : auctions.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-slate-100 bg-slate-50">
            <p className="text-sm font-semibold text-slate-900">No active deals</p>
            <p className="text-xs text-slate-500 mt-1">The clearinghouse is currently idle.</p>
          </div>
        ) : (
          auctions.map((item) => {
            const isAccepted = item.myAgentBid?.status === "ACCEPTED";
            const isDeclined = item.myAgentBid?.status === "DECLINED";

            return (
              <Link 
                href={`/dashboard/lender/live/invoice/${item.id}`} 
                key={item.id}
                className="group block bg-white border border-slate-200 p-6 hover:border-slate-900 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold font-mono text-slate-900">{item.invoiceNumber}</span>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded-sm">
                        Grade {item.riskGrade}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Building2 className="h-3 w-3 text-slate-400" />
                      <span className="font-medium">{item.buyerName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Face Value</span>
                    <div className="text-base font-bold font-mono text-slate-900">{formatINR(item.faceValue)}</div>
                  </div>
                </div>

                <div className="flex gap-4 text-xs text-slate-500 mb-6 border-t border-b border-slate-100 py-3">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-slate-400">Tenor</span>
                    <span className="font-semibold text-slate-700">{item.tenorDays}d</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-slate-400">Sector</span>
                    <span className="font-semibold text-slate-700 capitalize">{item.sector}</span>
                  </div>
                </div>

                {/* Agent Decision */}
                <div className={`p-3 text-xs border ${
                  isAccepted ? "bg-emerald-50 border-emerald-200 text-emerald-900" :
                  isDeclined ? "bg-slate-50 border-slate-200 text-slate-500" :
                  "bg-blue-50 border-blue-200 text-blue-900"
                }`}>
                  <div className="font-semibold mb-1 flex items-center justify-between">
                    <span>Agent: {item.myAgentBid?.status}</span>
                    {item.myAgentBid?.advanceRatePct ? (
                      <span className="font-mono">{item.myAgentBid.advanceRatePct}% @ {item.myAgentBid.annualAprPct}%</span>
                    ) : null}
                  </div>
                  <div className="text-[11px] opacity-80 leading-snug truncate">
                    {item.myAgentBid?.reason}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
