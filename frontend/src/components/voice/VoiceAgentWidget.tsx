"use client";

import React, { useState } from "react";
import { Radio, Sparkles, Volume2 } from "lucide-react";
import { ElevenLabsVoiceCockpit } from "./ElevenLabsVoiceCockpit";

interface VoiceAgentWidgetProps {
  dealContext?: string;
  className?: string;
  /** Scopes the assistant's answers to this auction. */
  opportunityId?: string;
}

export function VoiceAgentWidget({ dealContext, className = "", opportunityId }: VoiceAgentWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 border border-slate-700/80 backdrop-blur-md cursor-pointer ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Radio className="h-3.5 w-3.5 text-emerald-400" />
        <span>Ask CFO Voice AI</span>
      </button>

      <ElevenLabsVoiceCockpit
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        dealContext={dealContext}
        opportunityId={opportunityId}
      />
    </>
  );
}
