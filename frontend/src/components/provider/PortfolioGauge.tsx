"use client";

import React, { useState } from "react";
import { Sliders, Landmark } from "lucide-react";
import { CapitalProviderDetail, formatINR } from "@/lib/scoring";

interface PortfolioGaugeProps {
  providerDetail?: CapitalProviderDetail | null;
}

export const PortfolioGauge: React.FC<PortfolioGaugeProps> = ({ providerDetail }) => {
  const [minRating, setMinRating] = useState(providerDetail?.riskAppetiteFloor || "C");
  const [targetYield, setTargetYield] = useState(
    providerDetail?.hurdleRate ? Number(providerDetail.hurdleRate) * 100 : 13.0
  );
  const [concentrationCap, setConcentrationCap] = useState(
    providerDetail?.concentrationLimitPct ? Number(providerDetail.concentrationLimitPct) * 100 : 25
  );

  const totalLiq = providerDetail?.totalLiquidity ? Number(providerDetail.totalLiquidity) : 120000000;
  const availLiq = providerDetail?.availableLiquidity ? Number(providerDetail.availableLiquidity) : 119120000;
  const deployed = totalLiq - availLiq;
  const deployedPct = (deployed / totalLiq) * 100;

  const sectors = providerDetail?.sectorFocus && providerDetail.sectorFocus.length > 0
    ? providerDetail.sectorFocus
    : ["auto-components", "engineering", "textiles", "retail"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Exposure Progress Gauges */}
      <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-white font-bold text-xs">
              <Landmark className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm tracking-tight">
              Liquidity Deployment & Sector Mandate
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-700 font-mono">
            {formatINR(deployed)} / {formatINR(totalLiq)} ({deployedPct.toFixed(1)}%)
          </span>
        </div>

        {/* Global Pool Bar */}
        <div className="mb-6 space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-700">Total Pool Commitment</span>
            <span className="text-slate-500 font-mono">
              Available: <strong className="text-emerald-700">{formatINR(availLiq)}</strong>
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500"
              style={{ width: `${Math.max(4, deployedPct)}%` }}
            />
          </div>
        </div>

        {/* Sector Focus Tags */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Approved Sector Mandates
          </span>
          <div className="flex flex-wrap gap-2">
            {sectors.map((s, idx) => (
              <span
                key={idx}
                className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800 capitalize"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Autonomous Underwriting Rules */}
      <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-white font-bold text-xs">
              <Sliders className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm tracking-tight">
              Autonomous Bidding Mandate (LiteLLM Underwriter)
            </h3>
          </div>
          <span className="rounded bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            Mandate Active
          </span>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-slate-700">Risk Appetite Floor</span>
              <span className="font-bold text-slate-900">Grade {minRating} Min</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["A", "B", "C", "E"].map((r) => (
                <button
                  key={r}
                  onClick={() => setMinRating(r)}
                  className={`py-1.5 rounded-md border text-xs font-semibold transition ${
                    minRating === r
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Grade {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-slate-700">Hurdle Rate Target (APR)</span>
              <span className="font-bold text-slate-900 font-mono">{targetYield.toFixed(1)}% APR</span>
            </div>
            <input
              type="range"
              min="8"
              max="18"
              step="0.2"
              value={targetYield}
              onChange={(e) => setTargetYield(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>

          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-slate-700">Single Buyer Concentration Cap</span>
              <span className="font-bold text-slate-900 font-mono">{concentrationCap}% Max</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={concentrationCap}
              onChange={(e) => setConcentrationCap(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
