"use client";

import React from "react";
import { AlertCircle, Calendar, CheckCircle2, DollarSign, Layers, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { formatINR, formatPaiseToINR } from "@/lib/scoring";

interface ObjectiveConstraintsCardProps {
  sufficiencyFloor?: string | number | null;
  sufficiencyFloorPaise?: number;
  timingDeadline?: string | null;
  drivingObligation?: string | null;
  currentCash?: number | string;
  cashThreshold?: number | string;
}

export function ObjectiveConstraintsCard({
  sufficiencyFloor,
  // No defaults on these two.
  //
  // 94edf09 made the API derive each opportunity's real gates and the page
  // stopped defaulting them — but the card still defaulted `paise` to the demo
  // invoice's 90000000 and preferred it over the rupee prop the page actually
  // passes. The visible result was "You need ₹9,00,000.00 for GST remittance":
  // the obligation correct and derived, the amount the worked example's, in one
  // sentence contradicting itself.
  sufficiencyFloorPaise,
  timingDeadline,
  drivingObligation,
  currentCash = "0.00",
  cashThreshold = "100000.00",
}: ObjectiveConstraintsCardProps) {
  // Whichever the caller actually supplied. Preferring paise unconditionally
  // meant a correct rupee value lost to an absent paise one.
  const formattedFloor =
    sufficiencyFloorPaise != null
      ? formatPaiseToINR(sufficiencyFloorPaise)
      : sufficiencyFloor != null
        ? formatINR(sufficiencyFloor)
        : null;

  // A supplier whose obligations are covered by cash on hand has no gates —
  // cost alone decides. Rendering blanks, or worse the demo's thresholds,
  // would claim a constraint that does not exist.
  if (formattedFloor == null || timingDeadline == null) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900">No projected shortfall</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          This supplier&apos;s dated obligations are covered by cash on hand, so neither the
          sufficiency nor the timing gate binds here. Offers are ranked on true cost alone.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Lexicographic Cash Position & Objective Gates
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Why you need capital today
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            LienRho’s treasury engine derived your exact liquidity constraints from your dated operational obligations. 
            The marketplace automatically evaluates offers through these two non-negotiable gates before comparing interest rates.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gate 1: Sufficiency Floor */}
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/50 via-white to-slate-50 p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-md">
              Gate 1 · Sufficiency Floor
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs">
              1
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-3xl font-bold font-mono tracking-tight text-slate-900">
              {formattedFloor}
            </div>
            <div className="text-sm font-semibold text-slate-800">
              You need {formattedFloor} for {drivingObligation ?? "an upcoming obligation"}.
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              Any institutional offer delivering net proceeds below this threshold is disqualified, even if it quotes a lower headline APR.
            </p>
          </div>
        </div>

        {/* Gate 2: Timing Deadline */}
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-md">
              Gate 2 · Timing Deadline
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-xs">
              2
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-3xl font-bold font-mono tracking-tight text-slate-900">
              {timingDeadline}
            </div>
            <div className="text-sm font-semibold text-slate-800">
              Funds must land by {timingDeadline}.
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              Settlement speed must satisfy your payroll disbursement schedule. Offers settling after this date fail the timing gate.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-4 border border-slate-200/80 flex items-center gap-3">
        <AlertCircle className="h-4 w-4 text-slate-500 shrink-0" />
        <span className="text-xs text-slate-600 leading-relaxed">
          <strong>Deterministic Guarantee:</strong> No language model computes your financial figures. All thresholds are derived deterministically from operational accounts and verified against the Stitch double-entry journal.
        </span>
      </div>
    </div>
  );
}
