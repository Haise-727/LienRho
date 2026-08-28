"use client";

import React from "react";
import { Store, Landmark } from "lucide-react";
import { useUser, UserRole } from "@/context/UserContext";

export function RoleSwitcher() {
  const { role, setRole } = useUser();

  return (
    <div className="flex items-center rounded-lg bg-slate-100/90 p-1 border border-slate-200 shadow-2xs">
      <button
        type="button"
        onClick={() => setRole("supplier")}
        className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
          role === "supplier"
            ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <Store className={`h-3.5 w-3.5 ${role === "supplier" ? "text-emerald-600" : "text-slate-400"}`} />
        <span>Supplier View</span>
      </button>

      <button
        type="button"
        onClick={() => setRole("lender")}
        className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
          role === "lender"
            ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <Landmark className={`h-3.5 w-3.5 ${role === "lender" ? "text-blue-600" : "text-slate-400"}`} />
        <span>Capital Provider View</span>
      </button>
    </div>
  );
}
