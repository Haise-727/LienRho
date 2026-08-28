"use client";

import React, { useState } from "react";
import { Landmark, Shield, Sliders, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/scoring";
import Link from "next/link";

interface LiquidityPoolManagerProps {
  totalLiquidity?: string | number;
  availableLiquidity?: string | number;
}

export function LiquidityPoolManager({
  totalLiquidity = "120000000.00",
  availableLiquidity = "107500000.00",
}: LiquidityPoolManagerProps) {
  const [minTicketPaise, setMinTicketPaise] = useState(20000000); // ₹2,00,000
  const [maxTicketPaise, setMaxTicketPaise] = useState(1500000000); // ₹1.5 Crore
  const [concentrationCapPct, setConcentrationCapPct] = useState(25);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Landmark className="h-4 w-4 text-emerald-700" />
            Liquidity Pool & Ticket Sizing
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your committed balance and enforce ticket boundaries on deal allocations.
          </p>
        </div>

        <div className="rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-200 text-right">
          <span className="text-[10px] font-bold text-emerald-800 uppercase block">Available Pool</span>
          <span className="text-xs font-bold font-mono text-emerald-900">{formatINR(availableLiquidity)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Min Ticket */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-4 border border-slate-200/80">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
            Minimum Ticket Size
          </label>
          <span className="text-base font-bold font-mono text-slate-900 block">
            {formatINR(minTicketPaise / 100)}
          </span>
          <p className="text-[11px] text-slate-500">
            Invoices below this value will not receive bids from your agent.
          </p>
        </div>

        {/* Max Ticket */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-4 border border-slate-200/80">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
            Maximum Ticket Size
          </label>
          <span className="text-base font-bold font-mono text-slate-900 block">
            {formatINR(maxTicketPaise / 100)}
          </span>
          <p className="text-[11px] text-slate-500">
            Single invoice exposure ceiling for unilateral fills.
          </p>
        </div>

        {/* Buyer Concentration Limit */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-4 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Concentration Limit
            </label>
            <span className="text-xs font-bold font-mono text-blue-700">
              {concentrationCapPct}% Book
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="50"
            step="5"
            value={concentrationCapPct}
            onChange={(e) => setConcentrationCapPct(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <p className="text-[11px] text-slate-500">
            Maximum book percentage committed to any single corporate buyer obligor.
          </p>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <Link
          href="/dashboard/lender/live"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0047FF] hover:bg-[#0038D1] text-white px-6 py-3 text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <span>Observe Live Agent Deal Stream</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
