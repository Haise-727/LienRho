"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Calendar, CheckCircle2, Clock, ShieldCheck, ArrowUpRight } from "lucide-react";
import { formatINR } from "@/lib/scoring";

export interface InvoiceRowItem {
  id: string;
  invoiceNumber: string;
  buyerName: string;
  industry?: string;
  faceValue: number | string;
  currency?: string;
  maturityDate: string;
  status: "PENDING" | "AUCTION_LIVE" | "SETTLED" | string;
  verificationTier?: string;
}

interface InvoiceGridProps {
  invoices: InvoiceRowItem[];
}

export function InvoiceGrid({ invoices }: InvoiceGridProps) {
  const router = useRouter();

  const handleRowClick = (invoiceId: string) => {
    router.push(`/dashboard/supplier/invoice/${invoiceId}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AUCTION_LIVE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            AUCTION_LIVE
          </span>
        );
      case "SETTLED":
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-800">
            <CheckCircle2 className="h-3 w-3 text-blue-600" />
            SETTLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
            <Clock className="h-3 w-3 text-slate-500" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6 font-semibold">Invoice ID</th>
                <th className="py-3.5 px-6 font-semibold">Buyer Obligor</th>
                <th className="py-3.5 px-6 font-semibold text-right">Face Value</th>
                <th className="py-3.5 px-6 font-semibold">Maturity Date</th>
                <th className="py-3.5 px-6 font-semibold">Status</th>
                <th className="py-3.5 px-6 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => handleRowClick(inv.id)}
                  className="group cursor-pointer transition-colors duration-150 hover:bg-slate-50/80"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {inv.invoiceNumber}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {inv.buyerName}
                      </div>
                      {inv.industry && (
                        <div className="text-[11px] text-slate-500 capitalize pl-5">
                          {inv.industry}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right font-mono font-bold text-slate-900 text-base">
                    {formatINR(inv.faceValue)}
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {inv.maturityDate}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {getStatusBadge(inv.status)}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-600 group-hover:text-blue-600 group-hover:bg-blue-50 transition">
                      Details
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
