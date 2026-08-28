"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, ArrowRight, ShieldCheck, Lock, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { ComputedDeal, formatINR, formatPercent } from "@/lib/scoring";

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

  const providerName = deal.bid.provider?.name || "Institutional Provider";
  const archetype = deal.bid.provider?.archetype || "LP";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-3xl p-6 transition-all duration-200 ${
        deal.isDisqualified
          ? "bg-neutral-50/50 border border-red-200/80 opacity-80"
          : isBestMatch
          ? "bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] border-2 border-black"
          : "bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-neutral-200/80 hover:border-neutral-300"
      }`}
    >
      {/* Top Banner for Best Match */}
      {isBestMatch && !deal.isDisqualified && (
        <div className="absolute -top-3.5 left-6 flex items-center gap-1.5 rounded-full bg-black px-3.5 py-1 text-xs font-semibold text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          Pareto Optimum Match (Rank #1)
        </div>
      )}

      {/* Header Info */}
      <div className="flex items-start justify-between mt-1 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-900 font-bold text-sm">
            {providerName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900 text-base tracking-tight flex items-center gap-2">
              {providerName}
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                {archetype}
              </span>
              {deal.bid.recourse ? (
                <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                  Recourse
                </span>
              ) : (
                <span className="rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Non-Recourse
                </span>
              )}
            </h4>
            <span className="text-xs text-neutral-500 font-medium flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Stitch Verified Institution
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border ${
            deal.isDisqualified
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-amber-50 text-amber-800 border-amber-200/60"
          }`}>
            {deal.speedBadge}
          </span>
          <span className="text-[11px] text-neutral-400 mt-1 font-medium">
            Utility Score: {(deal.score * 100).toFixed(0)}/100
          </span>
        </div>
      </div>

      {/* Disqualification Tag if any */}
      {deal.isDisqualified && (
        <div className="mb-4 rounded-2xl bg-red-50 p-3 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>
            <strong>Disqualified by Gate:</strong> {deal.gateFailures.join(" • ")}
          </span>
        </div>
      )}

      {/* Plain-English Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4 rounded-2xl bg-neutral-50/80 p-4 border border-neutral-200/60">
        <div>
          <span className="text-xs text-neutral-500 font-medium block">Net Cash Today</span>
          <span className="text-xl font-bold tracking-tight text-neutral-900 block mt-0.5">
            {formatINR(deal.netCashToday)}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">
            {formatPercent(deal.bid.advanceRate)} upfront advance
          </span>
        </div>

        <div>
          <span className="text-xs text-neutral-500 font-medium block">Total Cost to Finance</span>
          <span className="text-xl font-bold tracking-tight text-neutral-900 block mt-0.5">
            {formatINR(deal.totalCost)}
          </span>
          <span className="text-[11px] text-neutral-500 font-medium">
            {formatPercent(deal.bid.annualRate)} APR + {formatINR(deal.flatFee)} fee
          </span>
        </div>

        <div>
          <span className="text-xs text-neutral-500 font-medium block">Remaining at Maturity</span>
          <span className="text-xl font-bold tracking-tight text-neutral-900 block mt-0.5">
            {formatINR(deal.reserveAmount)}
          </span>
          <span className="text-[11px] text-neutral-500 font-medium">
            Released upon buyer settlement
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
          disabled={isProcessing || deal.isDisqualified}
          className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold shadow-sm transition-all ${
            deal.isDisqualified
              ? "bg-neutral-300 text-neutral-500 cursor-not-allowed"
              : isBestMatch
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
