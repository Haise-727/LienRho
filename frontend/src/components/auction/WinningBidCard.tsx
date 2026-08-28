"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Calendar, 
  Volume2, 
  FileText,
  Building2
} from "lucide-react";
import type { ScoredOffer } from "@/lib/api-client";
import { formatPaiseToINR, formatBps } from "@/lib/scoring";

interface WinningBidCardProps {
  offer: ScoredOffer;
  invoiceId: string;
  onPlayAudio?: (offer: ScoredOffer) => void;
}

export function WinningBidCard({ offer, invoiceId, onPlayAudio }: WinningBidCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const router = useRouter();

  const handleAcceptDisburse = () => {
    // Simulate distributed lock preventing double-spending (CodeCrafters Concurrency Mock)
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push(`/dashboard/supplier/invoice/${invoiceId}/settlement`);
    }, 900);
  };

  const handlePlayAudioClick = () => {
    setIsPlayingAudio(true);
    if (onPlayAudio) {
      onPlayAudio(offer);
    }
    setTimeout(() => setIsPlayingAudio(false), 3500);
  };

  const providerName = offer.providerName || "Rapidfin";
  const advancePercent = (offer.offer.advanceRateBps / 100).toFixed(1) + "%";
  const annualApr = (offer.offer.annualRateBps / 100).toFixed(2) + "%";
  const trueCost = formatBps(offer.effectiveCostBps);
  const settlementDays = offer.offer.settlementDays;

  let speedText = `T+${settlementDays}`;
  if (settlementDays === 0) speedText = "Instant (T+0)";
  else if (settlementDays === 1) speedText = "24h (T+1)";
  else if (settlementDays === 3) speedText = "3 Days (T+3)";

  return (
    <div className="relative rounded-2xl bg-white border-2 border-emerald-600 shadow-xl p-8 transition-all duration-200 ring-4 ring-emerald-50/60">
      {/* Pareto Optimum Badge */}
      <div className="absolute -top-3.5 left-8 flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1 text-xs font-bold text-white shadow-sm tracking-tight uppercase">
        <Sparkles className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
        Pareto Optimum Rank #1 Match
      </div>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-2 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-lg shadow-sm">
            {providerName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                {providerName}
              </h3>
              {offer.offer.recourse === "NON_RECOURSE" ? (
                <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Non-Recourse
                </span>
              ) : (
                <span className="rounded-md bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 text-xs font-medium">
                  With Recourse
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Stitch Verified Institutional LP
              </span>
              <span className="text-slate-300">•</span>
              <span>All Sufficiency & Timing Gates Cleared</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:items-end gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 text-xs font-bold">
            <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600" /> {speedText}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Evaluated by Lexicographic Scorer
          </span>
        </div>
      </div>

      {/* Massive Focal Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6 rounded-xl bg-slate-50 p-6 border border-slate-200/80">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block">
            Net Cash Delivered
          </span>
          <span className="text-3xl font-black tracking-tight text-slate-900 block font-mono">
            {formatPaiseToINR(offer.netCashPaise)}
          </span>
          <span className="text-xs text-emerald-700 font-semibold block">
            {advancePercent} upfront advance ({formatPaiseToINR(offer.advancePaise)})
          </span>
        </div>

        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block">
            True Effective Cost
          </span>
          <span className="text-3xl font-black tracking-tight text-slate-900 block font-mono">
            {trueCost}
          </span>
          <span className="text-xs text-slate-500 font-medium block">
            {annualApr} headline APR + {formatPaiseToINR(offer.offer.feesPaise)} fee
          </span>
        </div>

        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block">
            Disbursal Speed
          </span>
          <span className="text-3xl font-black tracking-tight text-slate-900 block font-mono">
            {speedText}
          </span>
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-slate-400" /> Lands {offer.arrivalDate}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-slate-100 gap-4">
        <div className="flex items-center gap-2">
          {onPlayAudio && (
            <button
              type="button"
              onClick={handlePlayAudioClick}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium border transition ${
                isPlayingAudio
                  ? "bg-slate-200 text-slate-900 border-slate-300 animate-pulse"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              }`}
            >
              <Volume2 className="h-3.5 w-3.5 text-slate-600" />
              {isPlayingAudio ? "ElevenLabs Playing..." : "Audio Breakdown"}
            </button>
          )}
        </div>

        {/* Primary CTA with Concurrency Distributed Lock Mock */}
        <button
          type="button"
          onClick={handleAcceptDisburse}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm px-8 py-3.5 shadow-md hover:shadow-lg transition-all duration-150 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <Lock className="h-4 w-4 animate-spin text-white" />
              <span>Acquiring Distributed Lock & Disbursing...</span>
            </>
          ) : (
            <>
              <span>Accept Terms & Disburse</span>
              <ArrowRight className="h-4 w-4 text-white" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
