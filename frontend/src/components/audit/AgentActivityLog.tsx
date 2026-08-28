"use client";

import React, { useState, useEffect } from "react";
import { Terminal, Shield, Bot, ChevronUp, ChevronDown, CheckCircle2, Zap } from "lucide-react";
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
    action: "Broadcasted Verified Invoice #8042 ($100,000) to Clearinghouse."
  },
  {
    id: "2",
    time: "17:40:13",
    agent: "Alpha Bank Agent",
    badgeColor: "bg-purple-100 text-purple-800",
    action: "Generated Bid: 88% Advance @ 11.2% APR (Latency: 2 Hours)."
  },
  {
    id: "3",
    time: "17:40:14",
    agent: "Market Clearinghouse",
    badgeColor: "bg-black text-white",
    action: "Computed Multi-Attribute Pareto Optimum (Rank #1: Alpha Bank, Score: 0.92)."
  },
  {
    id: "4",
    time: "17:40:15",
    agent: "Stitch Ledger Engine",
    badgeColor: "bg-emerald-100 text-emerald-800",
    action: "Acquired Redis atomic lock (lock:provider:alpha). Staged Double-Entry Journal Entry #JE-1092."
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
        agent: "NexusX Bidding Agent",
        badgeColor: "bg-amber-100 text-amber-800",
        action: `Evaluated risk spread across 3 institutional pools. Liquidity healthy.`
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 15)]);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="w-80 md:w-96 rounded-3xl bg-neutral-900 text-white shadow-2xl border border-white/10 overflow-hidden">
        {/* Toggle Bar */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900/90 hover:bg-neutral-800/90 transition text-left"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold tracking-tight">Autonomous Agent Audit Stream</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono text-neutral-300">
              NexusX
            </span>
            {isOpen ? <ChevronDown className="h-4 w-4 text-neutral-400" /> : <ChevronUp className="h-4 w-4 text-neutral-400" />}
          </div>
        </button>

        {/* Expandable Logs */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="max-h-64 overflow-y-auto px-4 py-2 border-t border-white/10 font-mono text-[11px] space-y-2 bg-black/95"
            >
              {logs.map((log) => (
                <div key={log.id} className="leading-tight py-1 border-b border-white/5 last:border-none">
                  <div className="flex items-center justify-between text-neutral-500 text-[10px] mb-0.5">
                    <span>{log.time}</span>
                    <span className={`px-1.5 py-0.2 rounded font-sans font-semibold text-[9px] ${log.badgeColor}`}>
                      {log.agent}
                    </span>
                  </div>
                  <p className="text-neutral-300 text-[11px]">{log.action}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
