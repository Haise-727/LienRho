"use client";

import React, { useState } from "react";
import { Sliders, ShieldCheck, Check, Sparkles, Save, RotateCcw, AlertCircle } from "lucide-react";

interface RiskParameterFormProps {
  onSave?: (params: RiskParameters) => void;
}

export interface RiskParameters {
  minYieldApr: number; // e.g. 10.5
  maxAdvanceRatePct: number; // e.g. 85
  riskFloor: string; // "A" | "B" | "C" | "D"
  maxTenorDays: number; // e.g. 90
  minVerificationTier: string; // "BUYER_ACCEPTED" | "LEDGER_VERIFIED" | "SUPPLIER_ASSERTED"
  autoBidEnabled: boolean;
}

export function RiskParameterForm({ onSave }: RiskParameterFormProps) {
  const [params, setParams] = useState<RiskParameters>({
    minYieldApr: 10.5,
    maxAdvanceRatePct: 88,
    riskFloor: "B",
    maxTenorDays: 90,
    minVerificationTier: "LEDGER_VERIFIED",
    autoBidEnabled: true,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) onSave(params);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sliders className="h-4 w-4 text-blue-600" />
            Autonomous Agent Underwriting Parameters
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            These rules dictate how your LiteLLM bidding agent evaluates opportunities and places bids in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer">
            <span>Agent Autopilot</span>
            <input
              type="checkbox"
              checked={params.autoBidEnabled}
              onChange={(e) => setParams({ ...params, autoBidEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Minimum Acceptable Yield (Hurdle Rate) */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-5 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Minimum Acceptable Yield (APR)
            </label>
            <span className="text-base font-bold font-mono text-blue-700">
              {params.minYieldApr.toFixed(1)}% APR
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            The minimum risk-adjusted rate your agent will quote. Bids will never be submitted below this hurdle.
          </p>
          <input
            type="range"
            min="8.0"
            max="18.0"
            step="0.25"
            value={params.minYieldApr}
            onChange={(e) => setParams({ ...params, minYieldApr: parseFloat(e.target.value) })}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>8.0%</span>
            <span>13.0%</span>
            <span>18.0%</span>
          </div>
        </div>

        {/* 2. Maximum Advance Rate */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-5 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Maximum Advance Rate
            </label>
            <span className="text-base font-bold font-mono text-emerald-700">
              {params.maxAdvanceRatePct}% of Face Value
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            The maximum upfront liquidity percentage your capital pool will disburse on Day 0.
          </p>
          <input
            type="range"
            min="70"
            max="95"
            step="1"
            value={params.maxAdvanceRatePct}
            onChange={(e) => setParams({ ...params, maxAdvanceRatePct: parseInt(e.target.value, 10) })}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>70%</span>
            <span>85%</span>
            <span>95%</span>
          </div>
        </div>

        {/* 3. Risk Floors */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-5 border border-slate-200/80">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
            Buyer Risk Grade Floor
          </label>
          <p className="text-[11px] text-slate-500">
            Reject invoices from buyers rated below this grade automatically.
          </p>
          <div className="grid grid-cols-4 gap-2 pt-1">
            {["A", "B", "C", "D"].map((grade) => (
              <button
                type="button"
                key={grade}
                onClick={() => setParams({ ...params, riskFloor: grade })}
                className={`py-2 text-xs font-bold rounded-lg border transition ${
                  params.riskFloor === grade
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Grade {grade}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Minimum Verification Tier */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-5 border border-slate-200/80">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
            Minimum Verification Tier
          </label>
          <p className="text-[11px] text-slate-500">
            Weakest invoice proof tier your agent touches.
          </p>
          <select
            value={params.minVerificationTier}
            onChange={(e) => setParams({ ...params, minVerificationTier: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
          >
            <option value="BUYER_ACCEPTED">Buyer Accepted Only (Lowest Risk)</option>
            <option value="LEDGER_VERIFIED">Ledger Verified & 3-Way Matched</option>
            <option value="SUPPLIER_ASSERTED">Supplier Asserted (All Invoices)</option>
          </select>
        </div>
      </div>

      {savedSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>
            <strong>Rules Saved Successfully:</strong> Autonomous bidding agent mandate updated. All subsequent live auctions will be bid according to these parameters.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Deterministic pricing engine: LLM chooses posture; rates are exact.</span>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Save className="h-3.5 w-3.5" />
          <span>Save Underwriting Rules</span>
        </button>
      </div>
    </form>
  );
}
