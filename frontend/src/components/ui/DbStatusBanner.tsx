"use client";

import React, { useState } from "react";
import { Database, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { DbHealthResult } from "@/lib/api-client";

interface DbStatusBannerProps {
  health: DbHealthResult | null;
}

export const DbStatusBanner: React.FC<DbStatusBannerProps> = ({ health }) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !health) return null;

  // If DB is healthy and fully seeded, render nothing to keep Apple UI ultra-clean
  if (health.status === "ok" && health.seeded) return null;

  return (
    <div className="border-b border-amber-200/80 bg-amber-50/90 backdrop-blur-md px-6 py-2.5 text-xs text-amber-900 transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            <strong className="font-semibold">Local Demo Fallback Active:</strong> Database is offline or not yet seeded. Running on synthetic market state (INR ₹). Run <code className="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono text-[11px] text-amber-800">npx prisma db push && npx tsx prisma/seed.ts</code> to connect live.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-full p-1 text-amber-700 hover:bg-amber-100/80 transition"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
