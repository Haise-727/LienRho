"use client";

import React from "react";
import { PieChart, ShieldAlert, CheckCircle2, Sliders } from "lucide-react";

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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-2">
            <PieChart className="h-4 w-4 text-slate-700" />
            Sector Concentration Limits & Headroom
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time portfolio concentration caps. When a sector reaches capacity, the autonomous bidding agent pauses allocations in that sector.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200">
          Max Cap: 25% Book / Sector
        </span>
      </div>

      <div className="space-y-4">
        {exposures.map((item) => {
          const isHigh = item.percentage >= 75;
          const isMid = item.percentage >= 40 && item.percentage < 75;

          return (
            <div key={item.sector} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-2">
                  {item.sector}
                  {isHigh && (
                    <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2">
                      Near Cap
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500 font-sans text-[11px]">
                    {item.percentage}% capacity reached
                  </span>
                  <span className="font-bold text-slate-900">
                    ₹{(item.currentAllocatedPaise / 100000000).toFixed(1)}Cr / ₹{(item.capPaise / 100000000).toFixed(1)}Cr
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isHigh
                      ? "bg-amber-500"
                      : isMid
                      ? "bg-blue-600"
                      : "bg-emerald-600"
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
