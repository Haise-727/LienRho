"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Calendar, ShieldCheck, Tag } from "lucide-react";
import { formatINR } from "@/lib/scoring";

interface InvoiceHeaderProps {
  invoiceNumber: string;
  buyerName: string;
  industry?: string;
  faceValue: number | string;
  tenorDays: number;
  dueDate: string;
  status: string;
  verificationTier?: string;
}

export function InvoiceHeader({
  invoiceNumber,
  buyerName,
  industry,
  faceValue,
  tenorDays,
  dueDate,
  status,
  verificationTier = "BUYER_ACCEPTED",
}: InvoiceHeaderProps) {
  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/supplier"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Invoice Command Center
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl bg-white p-6 border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-slate-900">
              {invoiceNumber}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-bold text-emerald-800 font-mono">
              {status}
            </span>
          </div>

          <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-slate-700 font-medium">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              {buyerName}
            </span>
            {industry && (
              <>
                <span className="text-slate-300">•</span>
                <span className="capitalize">{industry}</span>
              </>
            )}
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Due {dueDate} ({tenorDays}d Tenor)
            </span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-slate-50 px-4 py-2 border border-slate-200/80 text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Face Value
            </span>
            <span className="text-lg font-bold font-mono text-slate-900">
              {formatINR(faceValue)}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 px-4 py-2 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Verification Tier
            </span>
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              {verificationTier.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
