"use client";

import React, { useState, useEffect } from "react";
import { Mic, MicOff, X, Sparkles, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ElevenLabsVoiceCockpitProps {
  isOpen: boolean;
  onClose: () => void;
  dealContext?: string;
}

export const ElevenLabsVoiceCockpit: React.FC<ElevenLabsVoiceCockpitProps> = ({
  isOpen,
  onClose,
  dealContext: _dealContext
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ sender: "user" | "cfo"; text: string }>>([
    {
      sender: "cfo",
      text: "Hello! I am your AI Treasury Assistant. I've analyzed your ₹10,00,000 receivable from Bharat Auto Ltd. Rapidfin is offering ₹9,34,188 upfront (T+0). Would you like to accept or review timing constraints?"
    }
  ]);
  const [userQuery, setUserQuery] = useState("");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      const speakTimer = setTimeout(() => {
        setIsSpeaking(true);
        timer = setTimeout(() => setIsSpeaking(false), 4000);
      }, 50);
      return () => {
        clearTimeout(speakTimer);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  const handleSendPrompt = (text: string) => {
    if (!text.trim()) return;
    const newHistory = [...transcript, { sender: "user" as const, text }];
    setTranscript(newHistory);
    setUserQuery("");
    setIsSpeaking(true);

    setTimeout(() => {
      let reply = "Understood. Re-clearing your auction via POST /api/match with updated urgency override.";
      if (text.toLowerCase().includes("cost") || text.toLowerCase().includes("rate") || text.toLowerCase().includes("apr")) {
        reply = "Evaluating true cost of capital: denominator is net cash delivered. Kaveri Capital offers 13.34% true cost but arrives past your 30 August payroll deadline.";
      } else if (text.toLowerCase().includes("accept") || text.toLowerCase().includes("disburse")) {
        reply = "Executing instant disbursal with Rapidfin. Stitch double-entry journal entry has been posted. ₹9,34,188 credited to Vertex Components cash account.";
      }
      setTranscript([...newHistory, { sender: "cfo" as const, text: reply }]);
      setIsSpeaking(false);
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 15 }}
            className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  {isSpeaking && (
                    <span className="absolute -inset-1 rounded-md border-2 border-emerald-500/40 animate-ping" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                    CFO Voice Cockpit
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200">
                      <Radio className="h-3 w-3 animate-pulse text-emerald-600" /> ElevenLabs WebRTC
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">Autonomous Multi-Attribute Treasury Advisor</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Audio Wave Visualizer Area */}
            <div className="flex flex-col items-center justify-center py-6 px-6 bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center justify-center gap-1.5 h-12 w-full">
                {[30, 50, 75, 40, 65, 80, 55, 40, 70, 25, 75, 50, 30].map((height, i) => (
                  <motion.div
                    key={i}
                    animate={
                      isSpeaking || isListening
                        ? { height: [8, height, 12, height * 0.7, 8] }
                        : { height: 6 }
                    }
                    transition={{
                      repeat: Infinity,
                      duration: 1.1,
                      delay: i * 0.07,
                      ease: "easeInOut"
                    }}
                    className={`w-1.5 rounded-full ${
                      isSpeaking ? "bg-emerald-600" : isListening ? "bg-slate-900" : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs font-medium text-slate-500">
                {isSpeaking
                  ? "Voice Agent Speaking..."
                  : isListening
                  ? "Listening to voice input..."
                  : "Voice channel active. Tap microphone to speak."}
              </p>
            </div>

            {/* Live Conversation Stream */}
            <div className="max-h-60 overflow-y-auto px-6 py-3 space-y-3">
              {transcript.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3.5 py-2 text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-[#0F172A] text-white"
                        : "bg-slate-100 text-slate-900 border border-slate-200/60"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="border-t border-slate-200 p-4 bg-white flex items-center gap-2">
              <button
                onClick={() => setIsListening(!isListening)}
                className={`flex h-10 w-10 items-center justify-center rounded-md transition-all ${
                  isListening
                    ? "bg-red-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                {isListening ? <Mic className="h-4 w-4 animate-pulse" /> : <MicOff className="h-4 w-4" />}
              </button>
              <input
                type="text"
                placeholder="Ask CFO e.g., 'Prioritize speed' or 'Explain Kaveri gate failure'..."
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendPrompt(userQuery)}
                className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
              />
              <button
                onClick={() => handleSendPrompt(userQuery)}
                className="rounded-md bg-[#0F172A] hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition"
              >
                Send
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
