"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownRight, Building2, ShieldCheck, Zap, TrendingDown } from "lucide-react";
import { Bid } from "@/lib/scoring";

interface BidTickerProps {
  bids: Bid[];
}

export const BidTicker: React.FC<BidTickerProps> = ({ bids }) => {
  const [activeBids, setActiveBids] = useState<Bid[]>(bids);

  // Periodic random micro-movements to simulate dynamic live bidding auction
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBids(prev => {
        const indexToUpdate = Math.floor(Math.random() * prev.length);
        const updated = [...prev];
        const target = updated[indexToUpdate];
        
        // Small random adjustment to rate or advance rate
        const deltaApr = (Math.random() * 0.004 - 0.002);
        const newApr = Math.max(0.085, Math.min(0.18, target.apr + deltaApr));
        
        updated[indexToUpdate] = {
          ...target,
          apr: Number(newApr.toFixed(3))
        };
        return updated;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-3xl bg-neutral-50/60 p-6 border border-black/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Live Institutional Auction Stream (NexusX Agents)
          </h4>
        </div>
        <span className="text-[11px] text-neutral-400 font-medium">3 Institutional Lenders Competing</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AnimatePresence>
          {activeBids.map((b) => (
            <motion.div
              key={b.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl bg-white p-4 shadow-sm border border-neutral-200/80 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 font-bold text-xs">
                    {b.providerName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="font-semibold text-neutral-900 text-xs">{b.providerName}</h5>
                    <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-medium">
                      <ShieldCheck className="h-3 w-3 text-emerald-500" /> Tier 1 Liquidity
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                  {b.rating}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3">
                <div>
                  <span className="text-[10px] text-neutral-400 block font-medium">Advance</span>
                  <span className="text-xs font-bold text-neutral-900">{(b.advanceRate * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block font-medium">APR</span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                    {(b.apr * 100).toFixed(1)}%
                    <TrendingDown className="h-3 w-3 text-emerald-500" />
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block font-medium">Disbursal</span>
                  <span className="text-xs font-bold text-neutral-800 flex items-center gap-0.5">
                    <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                    {b.speedDays < 0.2 ? "2 Hours" : `${b.speedDays} Days`}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
