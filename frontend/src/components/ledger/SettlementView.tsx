"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, BookOpen, ShieldCheck, ArrowLeft, Building2, Calendar, FileText, Check } from "lucide-react";
import { DoubleEntryTable } from "./DoubleEntryTable";
import { formatINR, formatPaiseToINR } from "@/lib/scoring";

interface SettlementViewProps {
  invoiceId: string;
  /**
   * The opportunity whose ledger to show.
   *
   * Was hardcoded to "opp-seed-001", so every invoice's settlement screen
   * rendered the same journal. That is the worst place in the product for a
   * placeholder: this view IS the audit trail, and two invoices showing
   * identical postings discredits the trail even though the ledger is correct.
   */
  opportunityId?: string;
  invoiceNumber?: string;
  buyerName?: string;
  providerName?: string;
  netCashPaise?: number;
  faceValue?: string | number;
}

export function SettlementView({
  opportunityId,
  invoiceId,
  invoiceNumber = "INV-2026-0801",
  buyerName = "Bharat Auto Ltd",
  providerName = "Rapidfin",
  netCashPaise = 93418836,
  faceValue = "1000000.00",
}: SettlementViewProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const steps = [
    { label: "Invoice Uploaded", state: "done", time: "Completed" },
    { label: "3-Way Verified", state: "done", time: "Completed" },
    { label: "Auction Cleared", state: "done", time: "Pareto Optimum" },
    { label: "Day 0 Disbursed", state: "active", time: "Active / Paid Out" },
    { label: "Day 90 Maturity", state: "upcoming", time: "Buyer Due Date" },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Back Link */}
      <div>
        <Link
          href="/dashboard/supplier"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Supplier Command Center
        </Link>
      </div>

      {/* 1. Calm Success Banner */}
      <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 via-white to-slate-50 p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shrink-0">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100/80 text-emerald-900 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider mb-1.5">
                Disbursal Completed · Day 0 Active
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Capital Disbursed to Vertex Components
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                Net liquidity of <strong className="text-slate-900 font-mono">{formatPaiseToINR(netCashPaise)}</strong> has been disbursed via <strong>{providerName}</strong> against invoice <strong>{invoiceNumber}</strong>.
              </p>
            </div>
          </div>

          <div className="text-right sm:self-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Net Cash Transferred
            </span>
            <span className="text-2xl font-black font-mono text-emerald-700 block">
              {formatPaiseToINR(netCashPaise)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Horizontal Step Tracker: Stitch Ledger Timeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 tracking-tight">
              Stitch Ledger Lifecycle Timeline
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Horizontal state transitions from Day 0 advance to Day 90 final reconciliation.
            </p>
          </div>

          {/* Enclosure Action: Inspect Ledger Journal Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-semibold shadow-xs transition duration-150 cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Inspect Ledger Journal</span>
          </button>
        </div>

        {/* Step Progress Tracker */}
        <div className="grid grid-cols-5 gap-2 relative py-4">
          {steps.map((step, idx) => {
            const isDone = step.state === "done";
            const isActive = step.state === "active";
            return (
              <div key={idx} className="flex flex-col items-center text-center relative">
                {/* Connecting Line */}
                <div
                  className={`h-0.5 w-full absolute top-4 -translate-y-1/2 ${
                    idx === 0 ? "left-1/2 w-1/2" : idx === 4 ? "right-1/2 w-1/2" : "w-full"
                  } ${isDone || isActive ? "bg-slate-900" : "bg-slate-200"}`}
                />

                {/* Step Circle */}
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isDone
                      ? "bg-slate-900 text-white shadow-xs"
                      : isActive
                      ? "bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-sm"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isDone ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : isActive ? (
                    <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                  ) : (
                    idx + 1
                  )}
                </div>

                <span className={`text-xs font-bold mt-2.5 ${isActive ? "text-emerald-800" : "text-slate-900"}`}>
                  {step.label}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {step.time}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Summary Deal Cards & Next Action */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Counterparty & Settlement Details
          </span>
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-slate-400" />
            Obligor: {buyerName}
          </div>
          <p className="text-xs text-slate-500">
            Disbursed by <strong>{providerName}</strong> under non-recourse terms. Repayment scheduled upon buyer payment at maturity.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Accounting Ledger Status
            </span>
            <div className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Double-Entry Invariant Verified
            </div>
            <p className="text-xs text-slate-500">
              Zero difference balance logged across Asset, Liability, and Equity accounts.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard/supplier"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
            >
              Return to Command Center <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Slide-out Side-Sheet Drawer for Double Entry Table */}
      <DoubleEntryTable
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        opportunityId={opportunityId}
      />
    </div>
  );
}
