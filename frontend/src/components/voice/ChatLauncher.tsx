"use client";

import React from "react";
import { MessageSquare } from "lucide-react";

// Floating launcher: a small bot bubble in the bottom-right. Clicking it opens
// the CFO cockpit. It deliberately does NOT cover or blur the page — it's a
// tiny fixed icon, and the cockpit itself docks to the corner rather than going
// full-screen.

export function ChatLauncher({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  if (open) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Open CFO AI assistant"
      title="Ask the CFO AI"
      className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-1 ring-black/5 transition hover:scale-105 hover:bg-slate-800 active:scale-95"
    >
      <MessageSquare className="h-6 w-6 text-emerald-400" />
      <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
      </span>
    </button>
  );
}
