"use client";

import React from "react";
import { DollarSign, TrendingUp, Layers, ShieldCheck, Landmark, Activity } from "lucide-react";
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Liquid Capital Available */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Available Liquidity
          </span>
          <Landmark className="h-4 w-4 text-slate-400" />
        </div>
        <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
          {formatINR(availableLiquidity)}
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Pool Total: {formatINR(totalLiquidity)}
        </div>
      </div>

      {/* Capital Deployed */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Capital Deployed
          </span>
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-700 tracking-tight">
          {formatINR(deployedCapital)}
        </div>
        <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
          <span>Active Book Yield: {averageYield}</span>
        </div>
      </div>

      {/* Hurdle Rate / Yield Target */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Hurdle Rate Target
          </span>
          <Activity className="h-4 w-4 text-blue-600" />
        </div>
        <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
          {hurdleRate}
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Automated pricing floor
        </div>
      </div>

      {/* Active Deal Flow in Market */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Matching Deal Flow
          </span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
        </div>
        <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
          {activeAuctionsCount} Live Auctions
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Agent bidding actively
        </div>
      </div>
    </div>
  );
}
