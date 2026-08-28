"use client";

import React from "react";
import { Zap, Percent, Sparkles, AlertCircle, Gauge } from "lucide-react";
import { formatINR } from "@/lib/scoring";

interface UrgencySliderProps {
  urgencyNudgeBps: number; // 0 to 500 bps
  onChange: (value: number) => void;
  drivingObligation?: string | null;
  sufficiencyFloor?: string | number | null;
}

export const UrgencySlider: React.FC<UrgencySliderProps> = ({
  urgencyNudgeBps,
  onChange,
  drivingObligation,
  sufficiencyFloor
}) => {
  return (
    <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm transition">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-900 text-white text-[11px] font-bold">
              1
            </span>
            <h3 className="font-semibold text-slate-900 text-sm tracking-tight">
              Urgency Override (bps)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Supplier capital preference derived from dated obligations. The matching engine filters through sufficiency and timing gates before cost ranking.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 self-start md:self-auto border border-slate-200/60">
          <Gauge className="h-3.5 w-3.5 text-slate-600" />
          <span>+{urgencyNudgeBps} bps Nudge</span>
          <span className="text-slate-400 font-normal">|</span>
          <span className="text-emerald-700">
            {urgencyNudgeBps >= 350 
              ? "Max Speed Priority" 
              : urgencyNudgeBps >= 150 
              ? "Pareto Balanced" 
              : "Lowest Effective Cost"}
          </span>
        </div>
      </div>

      {/* Derived Obligation Banner */}
      {drivingObligation && (
        <div className="mb-4 rounded-lg bg-slate-50 p-3 border border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-slate-600 shrink-0" />
            <span className="text-slate-700">
              <strong>Sufficiency Gate:</strong> Must clear <strong className="text-slate-900">{formatINR(sufficiencyFloor)}</strong> ({drivingObligation})
            </span>
          </div>
          {urgencyNudgeBps !== 0 && (
            <button
              onClick={() => onChange(0)}
              className="text-[11px] font-semibold text-slate-900 hover:text-emerald-600 underline transition"
            >
              Reset to Base (0 bps)
            </button>
          )}
        </div>
      )}

      {/* Slider Control */}
      <div className="relative pt-2 pb-1">
        <div className="flex justify-between items-center mb-1.5 text-xs text-slate-500 font-medium">
          <span>0 bps (Pure Cost)</span>
          <span className="font-semibold text-slate-900 font-mono">Current: {urgencyNudgeBps} bps</span>
          <span>500 bps (Max Urgency)</span>
        </div>

        <input
          type="range"
          min="0"
          max="500"
          step="25"
          value={urgencyNudgeBps}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition"
        />

        {/* Labels below slider */}
        <div className="flex justify-between items-center mt-3 text-xs">
          <button
            onClick={() => onChange(0)}
            className={`flex items-center gap-1.5 font-medium transition ${
              urgencyNudgeBps === 0 ? "text-emerald-700 font-semibold" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Percent className="h-3.5 w-3.5" />
            0 bps (Max Savings)
          </button>
          
          <button
            onClick={() => onChange(250)}
            className={`font-medium transition ${
              urgencyNudgeBps > 100 && urgencyNudgeBps < 400 ? "text-emerald-700 font-semibold" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            250 bps (Balanced)
          </button>

          <button
            onClick={() => onChange(500)}
            className={`flex items-center gap-1.5 font-medium transition ${
              urgencyNudgeBps >= 400 ? "text-emerald-700 font-semibold" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-600 fill-amber-600" />
            500 bps (Instant T+0)
          </button>
        </div>
      </div>
    </div>
  );
};
