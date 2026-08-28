"use client";

import React from "react";
import { Zap, Percent, Clock, Sparkles } from "lucide-react";

interface UrgencySliderProps {
  urgency: number; // 0 (Lowest Cost) to 1 (Max Speed)
  onChange: (value: number) => void;
}

export const UrgencySlider: React.FC<UrgencySliderProps> = ({ urgency, onChange }) => {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-neutral-200/80 transition hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-neutral-800 text-xs font-bold">
              1
            </span>
            <h3 className="font-semibold text-neutral-900 text-sm tracking-tight">
              Supplier Capital Objective (Multi-Attribute Pareto Engine)
            </h3>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Slide to recalibrate your utility function in real-time. The CodeCrafters matching engine re-scores all institutional offers immediately.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-800">
          <Sparkles className="h-3.5 w-3.5 text-neutral-500" />
          {urgency > 0.65 ? "Priority: Speed & Liquidity" : urgency < 0.35 ? "Priority: Lowest APR" : "Balanced Trade-Off"}
        </div>
      </div>

      {/* Slider Control */}
      <div className="relative pt-3 pb-1">
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
            Instant Liquidity (2h Disbursal)
          </button>
        </div>
      </div>
    </div>
  );
};
