"use client";

import React, { useState } from "react";
import { Phone, PhoneCall, CheckCircle2, ShieldCheck, FileText, Mic, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VoiceVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export const VoiceVerificationModal: React.FC<VoiceVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified
}) => {
  const [callState, setCallState] = useState<"idle" | "calling" | "connected" | "verified">("idle");

  const handleStartCall = () => {
    setCallState("calling");
    setTimeout(() => {
      setCallState("connected");
      setTimeout(() => {
        setCallState("verified");
        onVerified();
      }, 4000);
    }, 2000);
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
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
                  <PhoneCall className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                    Autonomous Outbound Verification Simulator
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
                      ElevenLabs Voice AI
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">Live AI agent phone call to enterprise buyer (Bharat Auto Ltd)</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: 3-Way Match Proof */}
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  3-Way Match Verification
                </h4>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-md bg-white border border-slate-200">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <FileText className="h-3.5 w-3.5 text-slate-400" /> Invoice INV-2026-0801
                    </span>
                    <span className="font-bold text-slate-900 font-mono">₹10,00,000.00</span>
                  </div>

                  <div className="flex items-center justify-between text-xs p-2.5 rounded-md bg-white border border-slate-200">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> PO #BA-PO-2026-991
                    </span>
                    <span className="font-semibold text-emerald-700">100% Match</span>
                  </div>

                  <div className="flex items-center justify-between text-xs p-2.5 rounded-md bg-white border border-slate-200">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Goods Receipt (GRN #4092)
                    </span>
                    <span className="font-semibold text-emerald-700">100% Verified</span>
                  </div>
                </div>

                <div className="rounded-md bg-emerald-50 p-3 border border-emerald-200 flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />
                  <p className="text-[11px] text-emerald-800 leading-tight">
                    Document hashes match enterprise ERP ledger. Ready for live voice confirmation.
                  </p>
                </div>
              </div>

              {/* Right Column: Interactive Phone Simulation */}
              <div className="flex flex-col justify-between rounded-lg bg-slate-900 text-white p-5 border border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      WebRTC Voice Channel
                    </span>
                    {callState === "connected" && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold animate-pulse font-mono">
                        ● 00:14 Live Call
                      </span>
                    )}
                  </div>

                  {callState === "idle" && (
                    <div className="py-6 text-center space-y-2">
                      <p className="text-xs text-slate-300">
                        Initiate autonomous verification call to Bharat Auto Ltd Procurement Desk.
                      </p>
                    </div>
                  )}

                  {(callState === "calling" || callState === "connected") && (
                    <div className="py-4 space-y-3">
                      <div className="flex justify-center items-center gap-1 h-8">
                        {[20, 35, 15, 40, 25, 45, 20].map((h, i) => (
                          <motion.div
                            key={i}
                            animate={{ height: [8, h, 8] }}
                            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                            className="w-1 bg-emerald-400 rounded-full"
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-center text-slate-300">
                        {callState === "calling" ? "Dialing +91 (22) 555-BHARAT..." : "Procurement Officer Responding..."}
                      </p>
                    </div>
                  )}

                  {callState === "verified" && (
                    <div className="py-4 text-center space-y-2">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <h5 className="font-bold text-sm text-emerald-400">Voice Verified & Signed</h5>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Voice Hash: 0x9f8b...e102
                      </p>
                    </div>
                  )}
                </div>

                {/* Call Control Button */}
                <div className="mt-4">
                  {callState === "idle" ? (
                    <button
                      onClick={handleStartCall}
                      className="w-full flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-semibold text-white transition"
                    >
                      <Phone className="h-4 w-4" /> Start Outbound Verification Call
                    </button>
                  ) : callState === "verified" ? (
                    <button
                      onClick={onClose}
                      className="w-full rounded-md bg-slate-800 border border-slate-700 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
                    >
                      Close & Approve Day 0 Disbursal
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 rounded-md bg-slate-800 py-2 text-xs font-medium text-slate-400"
                    >
                      <Mic className="h-4 w-4 animate-pulse text-emerald-400" /> Call in Progress...
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
