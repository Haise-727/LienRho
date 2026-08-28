"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, ArrowRight, ShieldCheck, Lock, Sparkles, AlertCircle, CheckCircle2, FileText, Calendar, Zap } from "lucide-react";
import type { ScoredOffer } from "@/lib/api-client";
import { formatPaiseToINR, formatBps } from "@/lib/scoring";

import { useSpeech } from "@/lib/voice/useSpeech";
import { offerScript } from "@/lib/voice/script";

interface DittoDealCardProps {
  offer: ScoredOffer;
  isBestMatch?: boolean;
  onAccept: (offer: ScoredOffer) => void;
  onViewLedger?: (offer: ScoredOffer) => void;
  onPlayAudio?: (offer: ScoredOffer) => void;
}

export const DittoDealCard: React.FC<DittoDealCardProps> = ({
  offer,
  isBestMatch = false,
  onAccept,
  onViewLedger,
  onPlayAudio
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { speak, stop, state: speechState, error: speechError, isBusy: isPlayingAudio } = useSpeech();

  const handleAcceptClick = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onAccept(offer);
    }, 800);
  };

  const handleAudioClick = () => {
    // Clicking again while it is talking stops it. Without this the only way
    // to interrupt a 20-second clip is to reload the page, which is not
    // something you want to discover mid-demo.
    if (isPlayingAudio) {
      stop();
      return;
    }
    onPlayAudio?.(offer);
    // The script is built from this offer's already-computed figures — the
    // spoken numbers are the same ones on the card, by construction.
    void speak(offerScript(offer));
  };

  const handleViewLedgerClick = () => {
    if (onViewLedger) {
      onViewLedger(offer);
    } else {
      const element = document.getElementById("ledger-timeline");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const providerName = offer.providerName || "Institutional Provider";
  const advancePercent = (offer.offer.advanceRateBps / 100).toFixed(1) + "%";
  const annualApr = (offer.offer.annualRateBps / 100).toFixed(2) + "%";
  const trueCost = formatBps(offer.effectiveCostBps);
  const settlementDays = offer.offer.settlementDays;
  const isDisqualified = offer.disqualified;

  // Format speed badge
  let speedText = `T+${settlementDays}`;
  if (settlementDays === 0) speedText = "Instant (T+0)";
  else if (settlementDays === 1) speedText = "24h (T+1)";
  else if (settlementDays === 3) speedText = "3 Days (T+3)";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl p-6 transition-all duration-200 border ${
        isDisqualified
          ? "bg-white/80 border-slate-200/90 shadow-xs opacity-90"
          : isBestMatch
          ? "bg-white border-2 border-emerald-600 shadow-md ring-4 ring-emerald-50"
          : "bg-white border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      {/* Top Banner for Best Match */}
      {isBestMatch && !isDisqualified && (
        <div className="absolute -top-3.5 left-6 flex items-center gap-1.5 rounded-full bg-[#059669] px-3 py-0.5 text-xs font-semibold text-white shadow-xs tracking-tight">
          <Sparkles className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
          Pareto Optimum Match (Rank #1)
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mt-1 mb-5">
        <div className="flex items-center gap-3.5">
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg font-bold text-sm shadow-xs ${
            isBestMatch && !isDisqualified
              ? "bg-[#0F172A] text-white"
              : "bg-slate-100 text-slate-800 border border-slate-200"
          }`}>
            {providerName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-[#0F172A] text-base tracking-tight">
                {providerName}
              </h4>
              {offer.offer.recourse === "NON_RECOURSE" ? (
                <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Non-Recourse
                </span>
              ) : (
                <span className="rounded bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[10px] font-medium">
                  With Recourse
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1 text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Stitch Verified Institutional LP
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-1.5 self-start">
          {isDisqualified ? (
            <span className="inline-flex items-center gap-1 rounded bg-[#D97706] text-white px-2.5 py-1 text-xs font-bold shadow-xs uppercase tracking-wider text-[11px]">
              Disqualified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 px-2.5 py-1 text-xs font-semibold">
              <Zap className="h-3 w-3 text-emerald-600 fill-emerald-600" /> {speedText}
            </span>
          )}
          <span className="text-[11px] text-slate-400 font-mono">
            {offer.rank ? `Rank #${offer.rank} by True Cost` : "Disqualified by Gate"}
          </span>
        </div>
      </div>

      {/* Disqualification Reason (Server Verbatim Explanation) */}
      {isDisqualified && (
        <div className="mb-4 rounded-lg bg-amber-50/80 p-3.5 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-amber-950 block">Gate Disqualification Notice:</span>
            {!offer.gates.sufficiency.passed && (
              <p className="text-amber-900 leading-relaxed">
                • <strong>Sufficiency Gate:</strong> {offer.gates.sufficiency.reason}
              </p>
            )}
            {!offer.gates.timing.passed && (
              <p className="text-amber-900 leading-relaxed">
                • <strong>Timing Gate:</strong> {offer.gates.timing.reason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Plain-English Breakdown Grid with Tabular Monospace Financials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4 rounded-lg bg-[#F8FAFC] p-4 border border-slate-200/90">
        <div className="space-y-0.5">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">Net Cash Delivered</span>
          <span className="text-2xl font-bold tracking-tight text-[#0F172A] block font-mono">
            {formatPaiseToINR(offer.netCashPaise)}
          </span>
          <span className="text-xs text-emerald-700 font-medium block">
            {advancePercent} upfront advance ({formatPaiseToINR(offer.advancePaise)})
          </span>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">True Effective Cost</span>
          <span className="text-2xl font-bold tracking-tight text-[#0F172A] block font-mono">
            {trueCost}
          </span>
          <span className="text-xs text-slate-500 font-medium block">
            {annualApr} headline APR + {formatPaiseToINR(offer.offer.feesPaise)} fee
          </span>
        </div>

        <div className="space-y-0.5">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">Disbursal & Timing</span>
          <span className="text-2xl font-bold tracking-tight text-[#0F172A] block font-mono">
            {speedText}
          </span>
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Calendar className="h-3 w-3 text-slate-400" /> Lands {offer.arrivalDate}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 gap-3">
        <div className="flex items-center gap-2">
          {onPlayAudio && (
            <button
              onClick={handleAudioClick}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition ${
                isPlayingAudio
                  ? "bg-slate-200 text-[#0F172A] border-slate-300 animate-pulse"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              }`}
            >
              <Volume2 className="h-3.5 w-3.5 text-slate-600" />
              {speechState === "loading"
                ? "Generating…"
                : speechState === "playing"
                  ? "Stop"
                  : "Audio Breakdown"}
            </button>
          )}

          {/* Say why it is silent. A button that does nothing and explains
              nothing reads as broken, and "no API key" is a setup step rather
              than a fault. */}
          {speechError && (
            <span className="text-[11px] leading-tight text-amber-700 max-w-[220px]">
              {speechState === "unconfigured" ? "Voice not configured" : speechError}
            </span>
          )}

          {/* Secondary Outline Action Button */}
          <button
            onClick={handleViewLedgerClick}
            className="flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold border border-[#E2E8F0] text-[#0F172A] bg-transparent hover:bg-slate-100 transition shadow-2xs"
          >
            <FileText className="h-3.5 w-3.5 text-slate-600" />
            View Ledger Trail
          </button>
        </div>

        {/* Primary Bid Acceptance Button */}
        <button
          onClick={handleAcceptClick}
          disabled={isProcessing || isDisqualified}
          className={`flex items-center gap-2 rounded-md px-5 py-2 text-xs font-semibold shadow-xs transition-all ${
            isDisqualified
              ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200"
              : "bg-[#059669] hover:bg-[#047857] text-white shadow-sm hover:shadow"
          }`}
        >
          {isProcessing ? (
            <>
              <Lock className="h-3.5 w-3.5 animate-spin text-white" />
              Processing Disbursal...
            </>
          ) : (
            <>
              Accept Terms & Disburse
              <ArrowRight className="h-3.5 w-3.5 text-white" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
