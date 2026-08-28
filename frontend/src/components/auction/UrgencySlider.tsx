"use client";

import React from "react";
import { Zap, Percent, Sparkles, AlertCircle } from "lucide-react";
import { formatINR } from "@/lib/scoring";

interface UrgencySliderProps {
  urgency: number; // 0 (Lowest Cost) to 1 (Max Speed)
  onChange: (value: number) => void;
  derivedWeight?: number | null;
  drivingObligation?: string | null;
  sufficiencyFloor?: string | number | null;
}

export const UrgencySlider: React.FC<UrgencySliderProps> = ({
  urgency,
  onChange,
  derivedWeight,
  drivingObligation,
  sufficiencyFloor
}) => {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-neutral-200/80 transition hover:shadow-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-neutral-800 text-xs font-bold">
              1
            </span>
            <h3 className="font-semibold text-neutral-900 text-sm tracking-tight">
              Supplier Capital Objective (Derived Lexicographic Utility)
            </h3>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Derived by analyzing your upcoming cash obligations. The matching engine filters through sufficiency and timing gates before ranking.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-800 self-start md:self-auto">
          <Sparkles className="h-3.5 w-3.5 text-neutral-500" />
          {urgency > 0.65 ? "Priority: Speed & Advance" : urgency < 0.35 ? "Priority: Lowest APR" : "Balanced Trade-Off"}
        </div>
      </div>

      {/* Derived Obligation Banner */}
      {drivingObligation && (
        <div className="mb-4 rounded-2xl bg-neutral-50 p-3 border border-neutral-200/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-neutral-500 shrink-0" />
            <span className="text-neutral-700">
              <strong>Sufficiency Gate:</strong> Must clear <strong className="text-neutral-900">{formatINR(sufficiencyFloor)}</strong> ({drivingObligation})
            </span>
          </div>
          {derivedWeight !== undefined && derivedWeight !== null && (
            <button
              onClick={() => onChange(derivedWeight)}
              className="text-[11px] font-semibold text-black underline hover:text-neutral-600 transition"
            >
              Reset to Derived ({Math.round(derivedWeight * 100)}%)
            </button>
          )}
        </div>
      )}

      {/* Slider Control */}
      <div className="relative pt-2 pb-1">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={urgency}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-black transition"
        />

        {/* Labels below slider */}
        <div className="flex justify-between items-center mt-3 text-xs">
          <button
            onClick={() => onChange(0)}
            className={`flex items-center gap-1.5 font-medium transition ${
              urgency < 0.25 ? "text-black font-semibold" : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <Percent className="h-3.5 w-3.5" />
            Lowest Cost (Max Savings)
          </button>
          
          <button
            onClick={() => onChange(0.5)}
            className={`font-medium transition ${
              urgency >= 0.35 && urgency <= 0.65 ? "text-black font-semibold" : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            Pareto Balanced
          </button>

          <button
            onClick={() => onChange(1)}
            className={`flex items-center gap-1.5 font-medium transition ${
              urgency > 0.75 ? "text-black font-semibold" : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            Instant Liquidity (T+0 Disbursal)
          </button>
        </div>
      </div>
    </div>
  );
};
