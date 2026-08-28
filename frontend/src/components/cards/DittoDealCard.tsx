"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, ArrowRight, ShieldCheck, Lock, Sparkles, AlertCircle, CheckCircle2, FileText, Calendar, Clock } from "lucide-react";
import type { ScoredOffer } from "@/lib/api-client";
import { formatPaiseToINR, formatBps } from "@/lib/scoring";

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
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handleAcceptClick = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onAccept(offer);
    }, 800);
  };

  const handleAudioClick = () => {
    setIsPlayingAudio(true);
    if (onPlayAudio) {
      onPlayAudio(offer);
    }
    setTimeout(() => setIsPlayingAudio(false), 3500);
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl p-6 transition-all duration-150 ${
        isDisqualified
          ? "bg-slate-50/70 border border-slate-200 opacity-90"
          : isBestMatch
          ? "bg-white border-2 border-emerald-600 shadow-sm"
          : "bg-white border border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Top Banner for Best Match */}
      {isBestMatch && !isDisqualified && (
        <div className="absolute -top-3 left-6 flex items-center gap-1.5 rounded-full bg-emerald-700 px-3.5 py-0.5 text-xs font-semibold text-white shadow-xs">
          <Sparkles className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
          Pareto Optimum Match (Rank #1)
        </div>
      )}

      {/* Header Info */}
      <div className="flex items-start justify-between mt-1 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-xs">
            {providerName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-base tracking-tight flex items-center gap-2">
              {providerName}
              {offer.offer.recourse === "NON_RECOURSE" ? (
                <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Non-Recourse
                </span>
              ) : (
                <span className="rounded bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[10px] font-medium">
                  With Recourse
                </span>
              )}
            </h4>
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Stitch Verified Institution
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          {isDisqualified ? (
            <span className="inline-flex items-center gap-1 rounded bg-[#D97706] text-white px-2.5 py-1 text-xs font-bold shadow-xs">
              Disqualified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-1 text-xs font-semibold">
              <Clock className="h-3 w-3 text-slate-600" /> {speedText}
            </span>
          )}
          <span className="text-[11px] text-slate-400 mt-1 font-mono">
            {offer.rank ? `Rank #${offer.rank}` : "Disqualified by Gate"}
          </span>
        </div>
      </div>

      {/* Disqualification Reason (Server Verbatim Explanation) */}
      {isDisqualified && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3.5 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-amber-950 block">Gate Disqualification Notice:</span>
            {!offer.gates.sufficiency.passed && (
              <p className="text-amber-900">
                • <strong>Sufficiency Gate:</strong> {offer.gates.sufficiency.reason}
              </p>
            )}
            {!offer.gates.timing.passed && (
              <p className="text-amber-900">
                • <strong>Timing Gate:</strong> {offer.gates.timing.reason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Plain-English Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
        <div>
          <span className="text-xs text-slate-500 font-medium block">Net Cash Delivered</span>
          <span className="text-xl font-bold tracking-tight text-slate-900 block mt-0.5 font-mono">
            {formatPaiseToINR(offer.netCashPaise)}
          </span>
          <span className="text-[11px] text-emerald-700 font-medium block mt-0.5">
            {advancePercent} upfront ({formatPaiseToINR(offer.advancePaise)})
          </span>
        </div>

        <div>
          <span className="text-xs text-slate-500 font-medium block">True Effective Cost</span>
          <span className="text-xl font-bold tracking-tight text-slate-900 block mt-0.5 font-mono">
            {trueCost}
          </span>
          <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
            {annualApr} headline APR + {formatPaiseToINR(offer.offer.feesPaise)} fee
          </span>
        </div>

        <div>
          <span className="text-xs text-slate-500 font-medium block">Disbursal & Arrival</span>
          <span className="text-xl font-bold tracking-tight text-slate-900 block mt-0.5 font-mono">
            {speedText}
          </span>
          <span className="text-[11px] text-slate-500 font-medium block mt-0.5 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Lands {offer.arrivalDate}
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
                  ? "bg-slate-200 text-slate-900 border-slate-300 animate-pulse"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              }`}
            >
              <Volume2 className="h-3.5 w-3.5" />
              {isPlayingAudio ? "ElevenLabs Playing..." : "Audio Breakdown"}
            </button>
          )}

          {/* Secondary Outline Action Button */}
          <button
            onClick={handleViewLedgerClick}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border border-[#E2E8F0] text-[#0F172A] bg-transparent hover:bg-slate-100 transition"
          >
            <FileText className="h-3.5 w-3.5 text-slate-600" />
            View Ledger Trail
          </button>
        </div>

        {/* Primary Bid Acceptance Button */}
        <button
          onClick={handleAcceptClick}
          disabled={isProcessing || isDisqualified}
          className={`flex items-center gap-2 rounded-md px-5 py-2 text-xs font-medium shadow-xs transition-all ${
            isDisqualified
              ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200"
              : "bg-[#059669] hover:bg-[#047857] text-white"
          }`}
        >
          {isProcessing ? (
            <>
              <Lock className="h-3.5 w-3.5 animate-spin" />
              Processing Disbursal...
            </>
          ) : (
            <>
              Accept Terms & Disburse
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
