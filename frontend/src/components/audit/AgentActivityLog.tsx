"use client";

import React, { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LogMessage {
  id: string;
  time: string;
  agent: string;
  badgeColor: string;
  action: string;
}

const initialLogs: LogMessage[] = [
  {
    id: "1",
    time: "17:40:12",
    agent: "Supplier Agent",
    badgeColor: "bg-blue-100 text-blue-800",
    action: "Broadcasted Verified Invoice INV-2026-0801 (₹10,00,000) to Clearinghouse."
  },
  {
    id: "2",
    time: "17:40:13",
    agent: "Rapidfin Agent",
    badgeColor: "bg-emerald-100 text-emerald-800",
    action: "Generated Bid: 95% Advance @ 13.5% APR (T+0 Disbursal)."
  },
  {
    id: "3",
    time: "17:40:14",
    agent: "Market Clearinghouse",
    badgeColor: "bg-slate-900 text-white",
    action: "Evaluated Lexicographic Sufficiency & Timing Gates (Passed: Rapidfin, Disqualified: Meridian, Kaveri)."
  },
  {
    id: "4",
    time: "17:40:15",
    agent: "Stitch Ledger Engine",
    badgeColor: "bg-emerald-100 text-emerald-800",
    action: "Verified balanced journal entry #JE-1092. Debit Cash / Credit Provider."
  }
];

export const AgentActivityLog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>(initialLogs);

  useEffect(() => {
    const interval = setInterval(() => {
      const time = new Date().toTimeString().split(" ")[0];
      const newLog: LogMessage = {
        id: Math.random().toString(),
        time,
        agent: "LiteLLM Underwriter",
        badgeColor: "bg-amber-100 text-amber-800",
        action: `Evaluated risk spread across institutional pools. Mandate checks passed.`
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 15)]);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="w-80 md:w-96 rounded-xl bg-slate-900 text-white shadow-xl border border-slate-800 overflow-hidden">
        {/* Toggle Bar */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900 hover:bg-slate-800 transition text-left"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold tracking-tight text-slate-100">Autonomous Multi-Agent Audit Stream</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700">
              LiteLLM
            </span>
            {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
          </div>
        </button>

        {/* Expandable Logs */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="max-h-64 overflow-y-auto px-4 py-2 border-t border-slate-800 font-mono text-[11px] space-y-2 bg-slate-950"
            >
              {logs.map((log) => (
                <div key={log.id} className="leading-tight py-1 border-b border-slate-800/80 last:border-none">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
                    <span>{log.time}</span>
                    <span className={`px-1.5 py-0.2 rounded font-sans font-semibold text-[9px] ${log.badgeColor}`}>
                      {log.agent}
                    </span>
                  </div>
                  <p className="text-slate-200 text-[11px]">{log.action}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
