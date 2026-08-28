"use client";

import React from "react";
import { PieChart } from "lucide-react";

export interface SectorExposure {
  sector: string;
  currentAllocatedPaise: number;
  capPaise: number;
  percentage: number;
}

const DEFAULT_EXPOSURES: SectorExposure[] = [
  {
    sector: "Automotive Components",
    currentAllocatedPaise: 2400000000,
    capPaise: 3000000000,
    percentage: 80,
  },
  {
    sector: "Textiles & Apparel",
    currentAllocatedPaise: 300000000,
    capPaise: 3000000000,
    percentage: 10,
  },
  {
    sector: "Precision Engineering",
    currentAllocatedPaise: 750000000,
    capPaise: 3000000000,
    percentage: 25,
  },
  {
    sector: "Electronics & Hardware",
    currentAllocatedPaise: 450000000,
    capPaise: 3000000000,
    percentage: 15,
  },
];

interface SectorExposureGaugesProps {
  exposures?: SectorExposure[];
}

export function SectorExposureGauges({ exposures = DEFAULT_EXPOSURES }: SectorExposureGaugesProps) {
  return (
    <div className="border border-slate-200 bg-white p-8 space-y-8">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900 tracking-tight flex items-center gap-2">
            <PieChart className="h-4 w-4 text-slate-700" />
            Sector Concentration Limits
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Real-time portfolio concentration caps. Agent pauses allocations at capacity.
          </p>
        </div>
        <span className="bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200 uppercase tracking-widest">
          Max Cap: 25% Book / Sector
        </span>
      </div>

      <div className="space-y-6">
        {exposures.map((item) => {
          const isHigh = item.percentage >= 75;
          const isMid = item.percentage >= 40 && item.percentage < 75;

          return (
            <div key={item.sector} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                  {item.sector}
                  {isHigh && (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 tracking-widest">
                      NEAR CAP
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-slate-400 font-sans text-[11px] uppercase tracking-wider">
                    {item.percentage}% capacity
                  </span>
                  <span className="font-bold text-slate-900">
                    ₹{(item.currentAllocatedPaise / 100000000).toFixed(1)}Cr / ₹{(item.capPaise / 100000000).toFixed(1)}Cr
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isHigh
                      ? "bg-amber-500"
                      : isMid
                      ? "bg-[#0047FF]"
                      : "bg-slate-900"
                  }`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
