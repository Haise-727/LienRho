"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchLedgerEntries, LedgerEntryItem } from "@/lib/api-client";
import { formatINR } from "@/lib/scoring";

interface StitchLedgerTimelineProps {
  opportunityId?: string;
}

export const StitchLedgerTimeline: React.FC<StitchLedgerTimelineProps> = ({ opportunityId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [entries, setEntries] = useState<LedgerEntryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadLedger() {
      setLoading(true);
      const res = await fetchLedgerEntries({ opportunityId });
      setEntries(res.entries);
      setLoading(false);
    }
    loadLedger();
  }, [opportunityId]);

  const steps = [
    { name: "Invoice Upload", status: "completed", date: "Day -2" },
    { name: "3-Way Match Verified", status: "completed", date: "Day -1" },
    { name: "Continuous Clearing", status: "current", date: "Live Now" },
    { name: "Day 0 Disbursal", status: "upcoming", date: "Pending" },
    { name: "Day 45 Maturity", status: "upcoming", date: "Settlement" }
  ];

  return (
    <div id="ledger-timeline" className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm scroll-mt-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white font-bold text-xs">
            ST
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-2">
              Stitch Double-Entry Financial State Machine
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                Balanced (∑D == ∑C)
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Immutable journal entries tracking Day 0 advance to buyer repayment and reserve release.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {isExpanded ? "Hide Ledger" : "Inspect Journal"}
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Progress Timeline Bar */}
      <div className="grid grid-cols-5 gap-2 relative mb-6">
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center w-full mb-2">
              <div
                className={`h-0.5 w-full absolute top-1/2 -translate-y-1/2 ${
                  idx === 0 ? "left-1/2 w-1/2" : idx === 4 ? "right-1/2 w-1/2" : "w-full"
                } ${
                  step.status === "completed" || step.status === "current"
                    ? "bg-slate-900"
                    : "bg-slate-200"
                }`}
              />
              <div
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  step.status === "completed"
                    ? "bg-slate-900 text-white"
                    : step.status === "current"
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {step.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-900 leading-tight">{step.name}</span>
            <span className="text-[10px] text-slate-400 font-medium">{step.date}</span>
          </div>
        ))}
      </div>

      {/* Collapsible Double-Entry Ledger Inspector */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-slate-100 pt-4"
          >
            <h4 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider flex items-center justify-between">
              <span>Recent Postings (Stitch Double-Entry Audit Trail)</span>
              {loading && <span className="text-[10px] text-slate-400 font-normal">Loading entries...</span>}
            </h4>

            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                    <div>
                      <span className="font-mono font-semibold text-[11px] text-slate-900">{entry.reference}</span>
                      <span className="ml-2 text-xs text-slate-600">{entry.description}</span>
                    </div>
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {entry.eventType}
                    </span>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 font-medium text-[10px]">
                        <th className="pb-1.5">Account Code</th>
                        <th className="pb-1.5">Account Name</th>
                        <th className="pb-1.5">Type</th>
                        <th className="pb-1.5 text-right">Debit</th>
                        <th className="pb-1.5 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                      {entry.postings.map((p) => (
                        <tr key={p.id} className="text-slate-700">
                          <td className="py-1 font-mono text-[10px] text-slate-500">{p.account.code}</td>
                          <td className="py-1 font-medium text-slate-900">{p.account.name}</td>
                          <td className="py-1">
                            <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold ${
                              p.direction === "DEBIT" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {p.direction === "DEBIT" ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownLeft className="h-2.5 w-2.5" />}
                              {p.direction}
                            </span>
                          </td>
                          <td className="py-1 text-right font-mono font-semibold text-slate-900">
                            {p.direction === "DEBIT" ? formatINR(p.amount) : "—"}
                          </td>
                          <td className="py-1 text-right font-mono font-semibold text-slate-900">
                            {p.direction === "CREDIT" ? formatINR(p.amount) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-500">
                      Balanced Invariant: {entry.totals?.balanced ? "✓ Balanced (∑D == ∑C)" : "⚠️ Unbalanced"}
                    </span>
                    <span className="font-mono text-slate-900">
                      Total: {formatINR(entry.totals?.debits)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
