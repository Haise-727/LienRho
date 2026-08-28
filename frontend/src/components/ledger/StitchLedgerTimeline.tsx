"use client";

import React, { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, ShieldCheck, ArrowUpRight, ArrowDownLeft, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface JournalEntryItem {
  id: string;
  timestamp: string;
  description: string;
  account: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
}

const mockLedgerEntries: JournalEntryItem[] = [
  {
    id: "JE-1092",
    timestamp: "10:42 AM",
    description: "Capital Advance Disbursal",
    account: "Lender Escrow Pool (Alpha Bank)",
    type: "DEBIT",
    amount: 88000
  },
  {
    id: "JE-1093",
    timestamp: "10:42 AM",
    description: "Disbursed Liquidity Arrival",
    account: "Supplier Primary Wallet",
    type: "CREDIT",
    amount: 87500
  },
  {
    id: "JE-1094",
    timestamp: "10:42 AM",
    description: "Origination & Clearing Fee",
    account: "Platform Clearing Revenue",
    type: "CREDIT",
    amount: 500
  },
  {
    id: "JE-1095",
    timestamp: "Pending Day 90",
    description: "Enterprise Invoice Settlement",
    account: "Metro Retail Payable Escrow",
    type: "DEBIT",
    amount: 100000
  }
];

export const StitchLedgerTimeline: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const steps = [
    { name: "Invoice Upload", status: "completed", date: "Aug 26" },
    { name: "3-Way Match Verified", status: "completed", date: "Aug 27" },
    { name: "Continuous Auction", status: "current", date: "Live Now" },
    { name: "Day 0 Disbursal", status: "upcoming", date: "Pending" },
    { name: "Day 90 Maturity", status: "upcoming", date: "Nov 25" }
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
                Balanced & Reconciled
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
            <h4 className="text-xs font-semibold text-neutral-700 mb-2 uppercase tracking-wider">
              Recent Postings (Stitch Double-Entry Audit Trail)
            </h4>
            <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-neutral-50/50">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200/80 text-neutral-400 font-medium text-[11px]">
                    <th className="p-3">Entry ID</th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60">
                  {mockLedgerEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-white transition">
                      <td className="p-3 font-mono text-neutral-500">{e.id}</td>
                      <td className="p-3 font-semibold text-neutral-900">{e.account}</td>
                      <td className="p-3 text-neutral-600">{e.description}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            e.type === "CREDIT"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {e.type === "CREDIT" ? (
                            <ArrowDownLeft className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          {e.type}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-neutral-900">
                        ${e.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
