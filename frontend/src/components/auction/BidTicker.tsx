"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Zap, TrendingDown, AlertCircle } from "lucide-react";
import { Bid, formatPercent } from "@/lib/scoring";

interface BidTickerProps {
  bids: Bid[];
}

export const BidTicker: React.FC<BidTickerProps> = ({ bids }) => {
  return (
    <div className="rounded-xl bg-slate-50/80 p-5 border border-slate-200 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Live Institutional Auction Stream (Autonomous LiteLLM Agents)
          </h4>
        </div>
        <span className="text-[11px] text-slate-400 font-medium font-mono">{bids.length} Offers Cleared</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AnimatePresence>
          {bids.map((b) => {
            const isDisqualified = (b.gateFailures && b.gateFailures.length > 0);
            return (
              <motion.div
                key={b.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                className={`rounded-lg p-3.5 border flex flex-col justify-between transition-all ${
                  isDisqualified
                    ? "bg-amber-50/40 border-amber-200"
                    : "bg-white border-slate-200 shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-white font-bold text-[11px]">
                      {b.provider?.name ? b.provider.name.substring(0, 2).toUpperCase() : "LP"}
                    </div>
                    <div>
                      <h5 className="font-semibold text-slate-900 text-xs flex items-center gap-1">
                        {b.provider?.name || "Institutional Provider"}
                        {isDisqualified && (
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                        )}
                      </h5>
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" /> {b.provider?.archetype || "TIER 1"}
                      </span>
                    </div>
                  </div>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 font-mono">
                    {b.settlementDays === 0 ? "T+0" : `T+${b.settlementDays}`}
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Advance</span>
                    <span className="text-xs font-bold text-slate-900 font-mono">{formatPercent(b.advanceRate)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">APR</span>
                    <span className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-0.5 font-mono">
                      {formatPercent(b.annualRate)}
                      <TrendingDown className="h-3 w-3 text-emerald-600" />
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Speed</span>
                    <span className="text-xs font-bold text-slate-800 flex items-center justify-center gap-0.5 font-mono">
                      <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                      {b.settlementDays === 0 ? "Instant" : `${b.settlementDays}d`}
                    </span>
                  </div>
                </div>

                {isDisqualified && b.gateFailures && (
                  <div className="mt-2 rounded bg-amber-100/80 px-2 py-0.5 text-[10px] text-amber-900 font-medium">
                    ⚠️ {b.gateFailures[0]}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
