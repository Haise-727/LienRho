"use client";

import React, { useState } from "react";
import { Landmark, ArrowRight, Save, Check } from "lucide-react";
import { formatINR } from "@/lib/scoring";
import Link from "next/link";
import { CapitalProviderDetail } from "@/lib/api-client";

interface LiquidityPoolManagerProps {
  provider: CapitalProviderDetail;
}

export function LiquidityPoolManager({ provider }: LiquidityPoolManagerProps) {
  const [minTicket, setMinTicket] = useState(Number(provider.minTicket) || 200000);
  const [maxTicket, setMaxTicket] = useState(Number(provider.maxTicket) || 15000000);
  const [concentrationCapPct, setConcentrationCapPct] = useState(Number(provider.concentrationLimitPct) * 100 || 25);
  
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await fetch(`/api/providers/${provider.id}/rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minTicket: minTicket,
          maxTicket: maxTicket,
          concentrationLimitPct: concentrationCapPct / 100,
        }),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 bg-white p-8 space-y-6">
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
          <span className="text-xs font-bold font-mono text-emerald-900">{formatINR(Number(provider.availableLiquidity))}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Min Ticket */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-4 border border-slate-200/80">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
            Minimum Ticket Size
          </label>
          <input 
            type="number"
            className="w-full text-base font-bold font-mono text-slate-900 bg-white border border-slate-200 rounded-md p-2"
            value={minTicket}
            onChange={(e) => setMinTicket(Number(e.target.value))}
          />
          <p className="text-[11px] text-slate-500">
            Invoices below this value will not receive bids from your agent.
          </p>
        </div>

        {/* Max Ticket */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-4 border border-slate-200/80">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
            Maximum Ticket Size
          </label>
          <input 
            type="number"
            className="w-full text-base font-bold font-mono text-slate-900 bg-white border border-slate-200 rounded-md p-2"
            value={maxTicket}
            onChange={(e) => setMaxTicket(Number(e.target.value))}
          />
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

      {savedSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in duration-150 mt-4">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>
            <strong>Limits Saved Successfully.</strong>
          </span>
        </div>
      )}

      <div className="pt-4 flex justify-between items-center border-t border-slate-100 mt-6">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-6 py-2.5 text-xs font-bold transition cursor-pointer"
        >
          <Save className="h-3.5 w-3.5" />
          <span>{saving ? "Saving..." : "Save Pool Limits"}</span>
        </button>

        <Link
          href="/dashboard/lender/live"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0047FF] hover:bg-[#0038D1] text-white px-6 py-2.5 text-xs font-bold transition cursor-pointer"
        >
          <span>Observe Live Agent Deal Stream</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </form>
  );
}
