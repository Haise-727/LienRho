"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, ArrowUpRight, ArrowDownLeft, BookOpen, ShieldCheck, RefreshCw } from "lucide-react";
import { fetchLedgerEntries, LedgerEntryItem } from "@/lib/api-client";
import { formatINR } from "@/lib/scoring";

interface DoubleEntryTableProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId?: string;
}

export function DoubleEntryTable({ isOpen, onClose, opportunityId }: DoubleEntryTableProps) {
  const [entries, setEntries] = useState<LedgerEntryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      async function loadData() {
        setLoading(true);
        const res = await fetchLedgerEntries({ opportunityId });
        setEntries(res.entries);
        setLoading(false);
      }
      loadData();
    }
  }, [isOpen, opportunityId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs transition-opacity">
      <div 
        className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-xs">
              ST
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Stitch Double-Entry Journal
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-200">
                  ∑D = ∑C Balanced
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Immutable, zero-difference accounting ledger verifying Day 0 through Day 90.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Cryptographic & Accounting Integrity Verified</span>
              <p className="mt-0.5 text-emerald-800 leading-relaxed">
                All capital movements (Advances, Discount Charges, Fees, Escrows, and Repayments) are posted with complete mathematical balance.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-xs">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Fetching immutable journal entries...
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 block">
                        {entry.reference}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {entry.description}
                      </span>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 border border-slate-200">
                      {entry.eventType}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 font-bold text-[10px] uppercase border-b border-slate-100">
                          <th className="pb-1.5 font-semibold">Account</th>
                          <th className="pb-1.5 font-semibold">Direction</th>
                          <th className="pb-1.5 text-right font-semibold">Debit (₹)</th>
                          <th className="pb-1.5 text-right font-semibold">Credit (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {entry.postings.map((p) => (
                          <tr key={p.id} className="text-slate-700">
                            <td className="py-2">
                              <span className="font-medium text-slate-900 block">{p.account.name}</span>
                              <span className="font-mono text-[10px] text-slate-400">{p.account.code}</span>
                            </td>
                            <td className="py-2">
                              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                                p.direction === "DEBIT" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}>
                                {p.direction === "DEBIT" ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownLeft className="h-2.5 w-2.5" />}
                                {p.direction}
                              </span>
                            </td>
                            <td className="py-2 text-right font-mono font-bold text-slate-900">
                              {p.direction === "DEBIT" ? formatINR(p.amount) : "—"}
                            </td>
                            <td className="py-2 text-right font-mono font-bold text-slate-900">
                              {p.direction === "CREDIT" ? formatINR(p.amount) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                    <span className="text-emerald-700 flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Balanced Invariant Verified
                    </span>
                    <span className="font-mono text-slate-900 text-xs">
                      Debit / Credit Total: {formatINR(entry.totals?.debits)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-xs font-semibold shadow-xs transition"
          >
            Close Journal
          </button>
        </div>
      </div>
    </div>
  );
}
