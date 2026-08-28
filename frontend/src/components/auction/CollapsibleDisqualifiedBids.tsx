"use client";

import React from "react";
import { AlertCircle, ChevronDown, ShieldAlert, XCircle } from "lucide-react";
import type { ScoredOffer } from "@/lib/api-client";
import { formatPaiseToINR, formatBps } from "@/lib/scoring";

interface CollapsibleDisqualifiedBidsProps {
  disqualifiedOffers: ScoredOffer[];
}

export function CollapsibleDisqualifiedBids({ disqualifiedOffers }: CollapsibleDisqualifiedBidsProps) {
  if (disqualifiedOffers.length === 0) return null;

  return (
    <div className="w-full pt-4">
      <details className="group rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <summary className="flex cursor-pointer items-center justify-between px-6 py-4 font-semibold text-slate-700 hover:bg-slate-50 transition-colors list-none select-none">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
              {disqualifiedOffers.length}
            </span>
            <span className="text-sm font-semibold text-slate-800">
              View {disqualifiedOffers.length} Disqualified {disqualifiedOffers.length === 1 ? "Offer" : "Offers"}
            </span>
            <span className="text-xs text-slate-400 font-normal">
              (Filtered by Sufficiency & Timing Gates)
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
        </summary>

        <div className="border-t border-slate-100 p-6 space-y-4 bg-slate-50/50">
          <p className="text-xs text-slate-500 mb-2 leading-relaxed">
            The clearinghouse automatically gated out these institutional offers because they either fell short of your payroll cash threshold or landed after your timing deadline.
          </p>

          <div className="space-y-3">
            {disqualifiedOffers.map((offer) => {
              const providerName = offer.providerName || "Institutional Provider";
              const advancePercent = (offer.offer.advanceRateBps / 100).toFixed(1) + "%";
              const annualApr = (offer.offer.annualRateBps / 100).toFixed(2) + "%";
              const trueCost = formatBps(offer.effectiveCostBps);

              return (
                <div
                  key={offer.offer.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs opacity-90 transition hover:opacity-100"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 font-bold text-xs text-slate-600 border border-slate-200">
                        {providerName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          {providerName}
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          Quoted {annualApr} APR ({advancePercent} advance)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                        <XCircle className="h-3.5 w-3.5 text-amber-700" />
                        Disqualified by Gate
                      </span>
                    </div>
                  </div>

                  {/* Verbatim Gate Failure Notice */}
                  <div className="rounded-lg bg-amber-50/90 border border-amber-200/80 p-3 text-xs text-amber-900 space-y-1">
                    <div className="font-semibold text-amber-950 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                      Gate Evaluation Breakdown:
                    </div>
                    {!offer.gates.sufficiency.passed && (
                      <p className="pl-5 text-amber-900">
                        • <strong>Sufficiency Gate Failed:</strong> {offer.gates.sufficiency.reason}
                      </p>
                    )}
                    {!offer.gates.timing.passed && (
                      <p className="pl-5 text-amber-900">
                        • <strong>Timing Gate Failed:</strong> {offer.gates.timing.reason}
                      </p>
                    )}
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans uppercase">Net Cash</span>
                      <span className="font-bold text-slate-700">{formatPaiseToINR(offer.netCashPaise)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans uppercase">True Cost</span>
                      <span className="font-bold text-slate-700">{trueCost}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans uppercase">Arrival</span>
                      <span className="font-bold text-slate-700">{offer.arrivalDate}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
}
