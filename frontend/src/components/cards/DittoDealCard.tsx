"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, CheckCircle2, Zap, ArrowRight, ShieldCheck, Lock, Sparkles } from "lucide-react";
import { ComputedDeal } from "@/lib/scoring";

interface DittoDealCardProps {
  deal: ComputedDeal;
  isBestMatch?: boolean;
  onAccept: (deal: ComputedDeal) => void;
  onPlayAudio: (deal: ComputedDeal) => void;
}

export const DittoDealCard: React.FC<DittoDealCardProps> = ({
  deal,
  isBestMatch = false,
  onAccept,
  onPlayAudio
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handleAcceptClick = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onAccept(deal);
    }, 800);
  };

  const handleAudioClick = () => {
    setIsPlayingAudio(true);
    onPlayAudio(deal);
    setTimeout(() => setIsPlayingAudio(false), 3500);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-3xl p-6 transition-all duration-200 ${
        isBestMatch
          ? "bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] border-2 border-black"
          : "bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-neutral-200/80 hover:border-neutral-300"
      }`}
    >
      {/* Top Banner for Best Match */}
      {isBestMatch && (
        <div className="absolute -top-3.5 left-6 flex items-center gap-1.5 rounded-full bg-black px-3.5 py-1 text-xs font-semibold text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          Pareto Optimum Match (Rank #1)
        </div>
      )}

      {/* Header Info */}
      <div className="flex items-start justify-between mt-1 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-900 font-bold text-sm">
            {deal.bid.providerName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900 text-base tracking-tight flex items-center gap-2">
              {deal.bid.providerName}
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                {deal.bid.rating} Rating
              </span>
            </h4>
            <span className="text-xs text-neutral-500 font-medium flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Stitch Verified Institution
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200/60">
            {deal.speedBadge}
          </span>
          <span className="text-[11px] text-neutral-400 mt-1 font-medium">
            Utility Score: {(deal.score * 100).toFixed(0)}/100
          </span>
        </div>
      </div>

      {/* Plain-English Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4 rounded-2xl bg-neutral-50/80 p-4 border border-neutral-200/60">
        <div>
          <span className="text-xs text-neutral-500 font-medium block">Net Cash Today</span>
          <span className="text-xl font-bold tracking-tight text-neutral-900 block mt-0.5">
            ${deal.netCashToday.toLocaleString()}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">
            {(deal.bid.advanceRate * 100).toFixed(0)}% upfront advance
          </span>
        </div>

        <div>
          <span className="text-xs text-neutral-500 font-medium block">Total Cost to Finance</span>
          <span className="text-xl font-bold tracking-tight text-neutral-900 block mt-0.5">
            ${deal.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[11px] text-neutral-500 font-medium">
            {(deal.bid.apr * 100).toFixed(1)}% APR + ${(deal.totalFee).toFixed(0)} fee
          </span>
        </div>

        <div>
          <span className="text-xs text-neutral-500 font-medium block">Remaining on Day 90</span>
          <span className="text-xl font-bold tracking-tight text-neutral-900 block mt-0.5">
            ${deal.remainingDay90.toLocaleString()}
          </span>
          <span className="text-[11px] text-neutral-500 font-medium">
            Settled upon buyer maturity
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 gap-3">
        <button
          onClick={handleAudioClick}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition ${
            isPlayingAudio
              ? "bg-purple-100 text-purple-700 animate-pulse"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          <Volume2 className="h-3.5 w-3.5" />
          {isPlayingAudio ? "ElevenLabs Playing..." : "Play 30s Audio Breakdown"}
        </button>

        <button
          onClick={handleAcceptClick}
          disabled={isProcessing}
          className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold shadow-sm transition-all ${
            isBestMatch
              ? "bg-black text-white hover:bg-neutral-800"
              : "bg-neutral-900 text-white hover:bg-black"
          }`}
        >
          {isProcessing ? (
            <>
              <Lock className="h-3.5 w-3.5 animate-spin" />
              Redis Locking & Posting...
            </>
          ) : (
            <>
              Accept & Disburse
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
