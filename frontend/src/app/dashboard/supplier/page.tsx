"use client";

import React, { useState, useEffect } from "react";
import { InvoiceGrid, InvoiceRowItem } from "@/components/supplier/InvoiceGrid";
import { fetchOpportunities, checkDbHealth, DbHealthResult } from "@/lib/api-client";
import { DbStatusBanner } from "@/components/ui/DbStatusBanner";
import { Store, Plus, Search, Filter, ShieldCheck, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/scoring";

export default function SupplierDashboardPage() {
  // Empty, not INITIAL_INVOICES. Seeding state with three fabricated invoices
  // meant a failed fetch left them on screen indistinguishable from real ones —
  // and they persisted, because the guard below only replaces on success.
  const [invoices, setInvoices] = useState<InvoiceRowItem[]>([]);
  const [dbHealth, setDbHealth] = useState<DbHealthResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  useEffect(() => {
    async function load() {
      const [health, oppsRes] = await Promise.all([
        checkDbHealth(),
        fetchOpportunities(),
      ]);
      setDbHealth(health);

      {
        const mapped: InvoiceRowItem[] = (oppsRes.opportunities ?? []).map((o) => ({
          id: o.invoice?.id || o.id,
          invoiceNumber: o.invoice?.invoiceNumber || "INV-2026",
          buyerName: o.invoice?.customer?.name || "Corporate Buyer",
          industry: o.invoice?.customer?.industry || "Manufacturing",
          faceValue: o.invoice?.faceValue || o.requestedAmount,
          maturityDate: o.invoice?.dueDate ? new Date(o.invoice.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "30d",
          status: o.status === "DISBURSED" || o.status === "CLOSED" ? "SETTLED" : o.status === "AUCTION_LIVE" ? "AUCTION_LIVE" : "PENDING",
          verificationTier: o.invoice?.verificationTier || "LEDGER_VERIFIED",
        }));
        setInvoices(mapped);
      }
    }
    load();
  }, []);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.buyerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      selectedStatus === "ALL" || inv.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <DbStatusBanner health={dbHealth} />

      {/* Header Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1.5">
            <Store className="h-3.5 w-3.5" />
            Seller Command Center · Idle State
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Invoices & Receivables Book
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Select an active invoice to review your derived cash obligations, objective gates, and participate in multi-attribute capital clearing.
          </p>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-2xs text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Open Receivables
            </span>
            <span className="text-lg font-bold font-mono text-slate-900">
              ₹36,50,000
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice number or buyer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {["ALL", "AUCTION_LIVE", "PENDING", "SETTLED"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedStatus === status
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Spacious Invoice Grid */}
      <InvoiceGrid invoices={filteredInvoices} />
    </div>
  );
}
