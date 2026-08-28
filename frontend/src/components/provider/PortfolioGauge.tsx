"use client";

import React, { useState } from "react";
import { Sliders, Shield, Zap, TrendingUp, DollarSign } from "lucide-react";

export const PortfolioGauge: React.FC = () => {
  const [minRating, setMinRating] = useState("A-");
  const [targetYield, setTargetYield] = useState(11.5);
  const [maxAdvance, setMaxAdvance] = useState(90);

  const exposures = [
    { sector: "Automotive & Heavy Industry", deployed: 1800000, cap: 2000000, color: "bg-black" },
    { sector: "Consumer Electronics", deployed: 400000, cap: 1500000, color: "bg-neutral-600" },
    { sector: "Pharmaceuticals & Healthcare", deployed: 850000, cap: 1000000, color: "bg-neutral-800" },
    { sector: "Renewable Energy & Solar", deployed: 320000, cap: 1200000, color: "bg-emerald-600" }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Exposure Progress Gauges */}
      <div className="rounded-3xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-neutral-200/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 font-bold text-xs">
              <DollarSign className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-neutral-900 text-sm tracking-tight">
              Sector Liquidity & Risk Caps
            </h3>
          </div>
          <span className="text-xs font-semibold text-neutral-600">$3.37M / $5.7M Deployed</span>
        </div>

        <div className="space-y-4">
          {exposures.map((exp, idx) => {
            const pct = (exp.deployed / exp.cap) * 100;
            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-neutral-700">{exp.sector}</span>
                  <span className="text-neutral-500 font-mono">
                    ${(exp.deployed / 1000000).toFixed(1)}M / ${(exp.cap / 1000000).toFixed(1)}M ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${exp.color} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Autonomous Underwriting Rules */}
      <div className="rounded-3xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-neutral-200/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-black text-white font-bold text-xs">
              <Sliders className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-neutral-900 text-sm tracking-tight">
              Autonomous Bidding Bot Rules (NexusX)
            </h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            Bot Active
          </span>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-neutral-700">Minimum Credit Rating Floor</span>
              <span className="font-bold text-neutral-900">{minRating} Min</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["AAA", "AA+", "A-", "BBB"].map((r) => (
                <button
                  key={r}
                  onClick={() => setMinRating(r)}
                  className={`py-1.5 rounded-xl border text-xs font-semibold transition ${
                    minRating === r
                      ? "border-black bg-black text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-neutral-700">Target Yield Hurdle (APR)</span>
              <span className="font-bold text-neutral-900">{targetYield}% APR</span>
            </div>
            <input
              type="range"
              min="8"
              max="18"
              step="0.5"
              value={targetYield}
              onChange={(e) => setTargetYield(parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-black"
            />
          </div>

          <div>
            <div className="flex justify-between font-medium mb-1">
              <span className="text-neutral-700">Max Advance Rate Target</span>
              <span className="font-bold text-neutral-900">{maxAdvance}% Advance</span>
            </div>
            <input
              type="range"
              min="75"
              max="95"
              step="1"
              value={maxAdvance}
              onChange={(e) => setMaxAdvance(parseInt(e.target.value))}
              className="w-full h-2 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-black"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
