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
      text: "Hello! I am your AI CFO. I've analyzed your $100,000 receivable from Metro Retail. Alpha Bank is offering $88,000 upfront in 2 hours. Would you like me to prioritize speed or negotiate a lower APR?"
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
      let reply = "Understood. Re-weighting your auction for immediate liquidity with Redis distributed locks.";
      if (text.toLowerCase().includes("cost") || text.toLowerCase().includes("rate") || text.toLowerCase().includes("apr")) {
        reply = "Optimizing for lowest total cost of capital. Horizon NBFC offers 9.8% APR, saving you $320 in fees.";
      } else if (text.toLowerCase().includes("accept") || text.toLowerCase().includes("disburse")) {
        reply = "Executing instant disbursal. Stitch double-entry journal entry #8902 has been posted. $88,000 credited to your primary account.";
      }
      setTranscript([...newHistory, { sender: "cfo" as const, text: reply }]);
      setIsSpeaking(false);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-black/5"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4 bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
                  <Sparkles className="h-4 w-4" />
                  {isSpeaking && (
                    <span className="absolute -inset-1 rounded-full border-2 border-black/40 animate-ping" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 text-sm tracking-tight flex items-center gap-2">
                    CFO Voice Cockpit
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                      <Radio className="h-3 w-3 animate-pulse text-emerald-500" /> ElevenLabs WebRTC
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500">Autonomous Treasury & Multi-Attribute Advisor</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Audio Wave Visualizer Area */}
            <div className="flex flex-col items-center justify-center py-8 px-6 bg-gradient-to-b from-neutral-50/80 to-white">
              <div className="flex items-center justify-center gap-1.5 h-16 w-full">
                {[40, 65, 90, 45, 80, 100, 70, 50, 85, 30, 95, 60, 40].map((height, i) => (
                  <motion.div
                    key={i}
                    animate={
                      isSpeaking || isListening
                        ? { height: [12, height, 16, height * 0.8, 12] }
                        : { height: 8 }
                    }
                    transition={{
                      repeat: Infinity,
                      duration: 1.2,
                      delay: i * 0.08,
                      ease: "easeInOut"
                    }}
                    className={`w-1.5 rounded-full ${
                      isSpeaking ? "bg-black" : isListening ? "bg-emerald-500" : "bg-neutral-200"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-4 text-xs font-medium text-neutral-500">
                {isSpeaking
                  ? "CFO Voice Agent Speaking..."
                  : isListening
                  ? "Listening to voice input..."
                  : "Voice channel active. Tap microphone to speak."}
              </p>
            </div>

            {/* Live Conversation Stream */}
            <div className="max-h-60 overflow-y-auto px-6 py-2 space-y-3">
              {transcript.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-black text-white"
                        : "bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="border-t border-neutral-100 p-4 bg-white flex items-center gap-2">
              <button
                onClick={() => setIsListening(!isListening)}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                  isListening
                    ? "bg-red-500 text-white shadow-lg shadow-red-200 scale-105"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {isListening ? <Mic className="h-5 w-5 animate-pulse" /> : <MicOff className="h-5 w-5" />}
              </button>
              <input
                type="text"
                placeholder="Ask CFO e.g., 'Prioritize speed' or 'Explain fees'..."
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendPrompt(userQuery)}
                className="flex-1 rounded-full border border-neutral-200 bg-neutral-50/50 px-4 py-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none transition"
              />
              <button
                onClick={() => handleSendPrompt(userQuery)}
                className="rounded-full bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 transition"
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
