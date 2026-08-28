"use client";

import React from "react";
import { formatINR } from "@/lib/scoring";

interface MetricsRowProps {
  totalLiquidity?: string | number;
  availableLiquidity?: string | number;
  deployedCapital?: string | number;
  activeAuctionsCount?: number;
  hurdleRate?: string | number;
  averageYield?: string | number;
}

export function MetricsRow({
  totalLiquidity = "120000000.00",
  availableLiquidity = "107500000.00",
  deployedCapital = "12500000.00",
  activeAuctionsCount = 3,
  hurdleRate = "13.0%",
  averageYield = "12.4%",
}: MetricsRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 border border-slate-200">
      {/* Total Liquid Capital Available */}
      <div className="bg-white p-6 border-b sm:border-b-0 sm:border-r border-slate-200 flex flex-col justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Available Liquidity
        </span>
        <div>
          <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {formatINR(availableLiquidity)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
            Pool Total: {formatINR(totalLiquidity)}
          </div>
        </div>
      </div>

      {/* Capital Deployed */}
      <div className="bg-white p-6 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Total Capital Deployed
        </span>
        <div>
          <div className="text-2xl font-bold font-mono text-emerald-700 tracking-tight">
            {formatINR(deployedCapital)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 uppercase tracking-wider">
            Active Book Yield: {averageYield}
          </div>
        </div>
      </div>

      {/* Hurdle Rate / Yield Target */}
      <div className="bg-white p-6 border-b sm:border-b-0 sm:border-r border-slate-200 flex flex-col justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Hurdle Rate Target
        </span>
        <div>
          <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {hurdleRate}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
            Automated pricing floor
          </div>
        </div>
      </div>

      {/* Active Deal Flow in Market */}
      <div className="bg-white p-6 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Matching Deal Flow
          </span>
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {activeAuctionsCount} Live Deals
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
            Agent bidding actively
          </div>
        </div>
      </div>
    </div>
  );
}
