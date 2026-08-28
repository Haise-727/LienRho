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
    <div className="rounded-3xl bg-neutral-50/60 p-6 border border-black/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Live Institutional Auction Stream (NexusX Bidding Agents)
          </h4>
        </div>
        <span className="text-[11px] text-neutral-400 font-medium">{bids.length} Institutional Offers Cleared</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AnimatePresence>
          {bids.map((b) => {
            const isDisqualified = (b.gateFailures && b.gateFailures.length > 0);
            return (
              <motion.div
                key={b.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`rounded-2xl p-4 shadow-sm border flex flex-col justify-between transition-all ${
                  isDisqualified
                    ? "bg-red-50/30 border-red-200/80"
                    : "bg-white border-neutral-200/80"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 font-bold text-xs">
                      {b.provider?.name ? b.provider.name.substring(0, 2).toUpperCase() : "LP"}
                    </div>
                    <div>
                      <h5 className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
                        {b.provider?.name || "Institutional Provider"}
                        {isDisqualified && (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                      </h5>
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-medium">
                        <ShieldCheck className="h-3 w-3 text-emerald-500" /> {b.provider?.archetype || "TIER 1"}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                    {b.settlementDays === 0 ? "T+0" : `T+${b.settlementDays}`}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3">
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-medium">Advance</span>
                    <span className="text-xs font-bold text-neutral-900">{formatPercent(b.advanceRate)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-medium">APR</span>
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                      {formatPercent(b.annualRate)}
                      <TrendingDown className="h-3 w-3 text-emerald-500" />
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-medium">Disbursal</span>
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-0.5">
                      <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                      {b.settlementDays === 0 ? "Instant" : `${b.settlementDays}d`}
                    </span>
                  </div>
                </div>

                {isDisqualified && b.gateFailures && (
                  <div className="mt-2.5 rounded-lg bg-red-100/70 px-2 py-1 text-[10px] text-red-700 font-medium">
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
