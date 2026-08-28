"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal, ChevronUp, ChevronDown, Play, Pause, Trash2, Cpu } from "lucide-react";

interface LogEntry {
  timestamp: string;
  level: "INFO" | "DECISION" | "BID" | "WARN";
  message: string;
}

const SEED_LOGS: LogEntry[] = [
  {
    timestamp: "10:14:02.104",
    level: "INFO",
    message: "[Agent] Connected to LienRho WebSocket deal stream.",
  },
  {
    timestamp: "10:14:03.220",
    level: "INFO",
    message: "[Agent] Evaluating INV-2026-0801 (Bharat Auto Ltd, ₹10,00,000, 45d)...",
  },
  {
    timestamp: "10:14:03.450",
    level: "DECISION",
    message: "[Agent] Gate check passed. Sector: Auto. Concentration: 80% (Cap 25% OK). Risk: Grade A.",
  },
  {
    timestamp: "10:14:03.890",
    level: "BID",
    message: "[Agent] Submitted Bid: 88% Advance at 12.2% APR (T+1 Settlement).",
  },
  {
    timestamp: "10:14:08.115",
    level: "INFO",
    message: "[Agent] Evaluating INV-2026-0802 (Sundaram Textiles, ₹4,50,000, 60d)...",
  },
  {
    timestamp: "10:14:08.310",
    level: "DECISION",
    message: "[Agent] Sector check passed. Sector: Textiles. Capacity: 10%. Hurdle rate 12.8% met.",
  },
  {
    timestamp: "10:14:08.700",
    level: "BID",
    message: "[Agent] Submitted Bid: 90% Advance at 12.8% APR (T+1 Settlement). Won allocation.",
  },
  {
    timestamp: "10:14:15.540",
    level: "INFO",
    message: "[Agent] Evaluating INV-2026-0803 (Orion Retail, ₹22,00,000, 30d)...",
  },
  {
    timestamp: "10:14:15.620",
    level: "WARN",
    message: "[Agent] Declined opportunity: Invoice risk Grade E is below minimum risk floor Grade B.",
  },
];

export function NexusAgentTerminal() {
  const [isOpen, setIsOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>(SEED_LOGS);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Periodic heartbeat log simulation
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      const time = new Date().toTimeString().split(" ")[0] + "." + Math.floor(Math.random() * 900 + 100);
      const randomLogs = [
        { timestamp: time, level: "INFO" as const, message: "[Agent] Polling clearinghouse heartbeat... 0 unallocated locks." },
        { timestamp: time, level: "INFO" as const, message: "[Agent] Re-checking liquidity headroom: ₹10.75Cr unencumbered." },
        { timestamp: time, level: "DECISION" as const, message: "[Agent] Underwriting rules active: Min APR 10.5%, Max Advance 88%." },
      ];
      const nextLog = randomLogs[Math.floor(Math.random() * randomLogs.length)];
      setLogs((prev) => [...prev.slice(-30), nextLog]);
    }, 6000);

    return () => clearInterval(interval);
  }, [isStreaming]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl overflow-hidden font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />
          </div>
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span className="font-bold text-slate-200 text-xs font-sans">
              NexusX Autonomous Agent Real-Time Audit Stream
            </span>
            <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.2 text-[10px] font-bold">
              LIVE STREAM
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsStreaming(!isStreaming)}
            className="flex items-center gap-1 text-[11px] font-sans rounded px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            {isStreaming ? (
              <>
                <Pause className="h-3 w-3 text-amber-400" /> Pause Stream
              </>
            ) : (
              <>
                <Play className="h-3 w-3 text-emerald-400" /> Resume Stream
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 text-[11px] font-sans rounded px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {isOpen ? "Collapse Terminal" : "Expand Console"}
          </button>
        </div>
      </div>

      {/* Terminal Monospace Stream */}
      {isOpen && (
        <div
          ref={logContainerRef}
          className="h-64 overflow-y-auto p-5 space-y-1.5 bg-slate-950 font-mono text-[11.5px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800"
        >
          {logs.map((log, idx) => {
            let color = "text-slate-300";
            if (log.level === "DECISION") color = "text-blue-400";
            if (log.level === "BID") color = "text-emerald-400 font-bold";
            if (log.level === "WARN") color = "text-amber-400";

            return (
              <div key={idx} className="flex items-start gap-3 hover:bg-slate-900/60 py-0.5 px-1 rounded transition-colors">
                <span className="text-slate-500 select-none text-[10.5px]">[{log.timestamp}]</span>
                <span className={color}>{log.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
