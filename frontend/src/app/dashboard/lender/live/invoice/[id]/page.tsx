import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function LenderInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      <div>
        <Link
          href="/dashboard/lender/live"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Live Deal Stream
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Deal Details</h1>
        <p className="text-sm text-slate-600 mb-8">
          Detailed breakdown for Opportunity ID: <span className="font-mono">{id}</span>
        </p>

        <div className="bg-slate-50 border border-slate-100 p-6 text-center text-sm text-slate-500">
          This is a placeholder for the detailed invoice breakdown and agent evaluation trace.
        </div>
      </div>
    </div>
  );
}
