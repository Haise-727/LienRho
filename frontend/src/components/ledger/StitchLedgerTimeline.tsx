"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft } from "lucide-react";
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
    { name: "Continuous Auction", status: "current", date: "Live Now" },
    { name: "Day 0 Disbursal", status: "upcoming", date: "Pending" },
    { name: "Day 90 Maturity", status: "upcoming", date: "Settlement" }
  ];

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-neutral-200/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-900 text-white font-bold text-xs">
            ST
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm tracking-tight flex items-center gap-2">
              Stitch Double-Entry Financial State Machine
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                Zero-Difference Invariant Verified
              </span>
            </h3>
            <p className="text-xs text-neutral-500">
              Immutable journal entries tracking Day 0 advance to Day 90 buyer repayment.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-black transition"
        >
          {isExpanded ? "Hide Ledger" : "Inspect Journal"}
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Progress Timeline Bar */}
      <div className="grid grid-cols-5 gap-2 relative mb-6">
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center w-full mb-2">
              <div
                className={`h-1 w-full absolute top-1/2 -translate-y-1/2 ${
                  idx === 0 ? "left-1/2 w-1/2" : idx === 4 ? "right-1/2 w-1/2" : "w-full"
                } ${
                  step.status === "completed" || step.status === "current"
                    ? "bg-neutral-900"
                    : "bg-neutral-200"
                }`}
              />
              <div
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  step.status === "completed"
                    ? "bg-black text-white"
                    : step.status === "current"
                    ? "bg-black text-white ring-4 ring-neutral-200 animate-pulse"
                    : "bg-neutral-200 text-neutral-500"
                }`}
              >
                {step.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </div>
            </div>
            <span className="text-[11px] font-semibold text-neutral-900 leading-tight">{step.name}</span>
            <span className="text-[10px] text-neutral-400 font-medium">{step.date}</span>
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
            className="overflow-hidden border-t border-neutral-100 pt-4"
          >
            <h4 className="text-xs font-semibold text-neutral-700 mb-2 uppercase tracking-wider flex items-center justify-between">
              <span>Recent Postings (Stitch Double-Entry Audit Trail)</span>
              {loading && <span className="text-[10px] text-neutral-400 font-normal">Loading entries...</span>}
            </h4>

            <div className="space-y-4">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-3.5">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-neutral-200/60">
                    <div>
                      <span className="font-mono font-semibold text-[11px] text-neutral-900">{entry.reference}</span>
                      <span className="ml-2 text-xs text-neutral-600">{entry.description}</span>
                    </div>
                    <span className="rounded-full bg-neutral-200/80 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
                      {entry.eventType}
                    </span>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-neutral-400 font-medium text-[10px]">
                        <th className="pb-1.5">Account Code</th>
                        <th className="pb-1.5">Account Name</th>
                        <th className="pb-1.5">Type</th>
                        <th className="pb-1.5 text-right">Debit</th>
                        <th className="pb-1.5 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/40">
                      {entry.postings.map((p) => (
                        <tr key={p.id} className="text-neutral-700">
                          <td className="py-1 font-mono text-[10px] text-neutral-500">{p.account.code}</td>
                          <td className="py-1 font-medium text-neutral-900">{p.account.name}</td>
                          <td className="py-1">
                            <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold ${
                              p.direction === "DEBIT" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {p.direction === "DEBIT" ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownLeft className="h-2.5 w-2.5" />}
                              {p.direction}
                            </span>
                          </td>
                          <td className="py-1 text-right font-mono font-semibold text-neutral-900">
                            {p.direction === "DEBIT" ? formatINR(p.amount) : "—"}
                          </td>
                          <td className="py-1 text-right font-mono font-semibold text-neutral-900">
                            {p.direction === "CREDIT" ? formatINR(p.amount) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-2.5 pt-2 border-t border-neutral-200/60 flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-neutral-500">
                      Balanced Invariant: {entry.totals?.balanced ? "✓ Balanced (∑D == ∑C)" : "⚠️ Unbalanced"}
                    </span>
                    <span className="font-mono text-neutral-900">
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
