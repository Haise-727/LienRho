"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Mic, MicOff, X, Sparkles, Radio, Scale, Layers, Plus, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpeech } from "@/lib/voice/useSpeech";
import { useMicrophone } from "@/lib/voice/useMicrophone";
import { Markdown } from "@/components/Markdown";

type AgentType = "treasury" | "audit";

interface SanitizedTool {
  tool: string;
  ok: boolean;
  durationMs?: number;
  summary: string;
  clipped: boolean;
  preview?: string;
}

interface ApprovalRequest {
  tool: string;
  args: unknown;
  threadId: string;
}

type Message =
  | { kind: "msg"; sender: "user" | "cfo"; text: string; id?: string }
  | { kind: "tool"; tool: string; summary: string; ok: boolean; durationMs?: number; preview?: string; clipped: boolean; id?: string }
  | { kind: "meta"; traceId?: string; steps?: number; id?: string };

interface ThreadMeta {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface ElevenLabsVoiceCockpitProps {
  isOpen: boolean;
  onClose: () => void;
  dealContext?: string;
  opportunityId?: string;
}

interface RawStoredMessage {
  kind: string;
  role: string;
  content: string;
  meta?: {
    tool?: string;
    ok?: boolean;
    durationMs?: number;
    preview?: string;
    clipped?: boolean;
  } | null;
}

const THREAD_KEY = "cfo-thread-id";
const USER_KEY = "cfo-user-id";

// Stable per-browser user id so threads are scoped per user (multi-tenancy).
function getLocalUserId(): string {
  if (typeof window === "undefined") return "anonymous";
  let id = window.localStorage.getItem(USER_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `u-${Date.now()}`;
    window.localStorage.setItem(USER_KEY, id);
  }
  return id;
}
const authHeaders = (): Record<string, string> => ({ "x-user-id": getLocalUserId() });

export const ElevenLabsVoiceCockpit: React.FC<ElevenLabsVoiceCockpitProps> = ({
  isOpen,
  onClose,
  opportunityId,
}) => {
  const { speak, stop: stopSpeaking, state: speechState, error: speechError } = useSpeech();
  const isSpeaking = speechState === "playing" || speechState === "loading";
  const [agentType, setAgentType] = useState<AgentType>("treasury");
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [thinking, setThinking] = useState(false);
  const [showThreads, setShowThreads] = useState(false);
  const threadInit = useRef(false);
  const finalText = useRef("");
  const pendingTools = useRef<Record<string, string[]>>({});

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/threads", { cache: "no-store", headers: authHeaders() });
      const data = await res.json();
      setThreads(data?.threads ?? []);
    } catch {
      /* non-fatal */
    }
  }, []);

  const restoreHistory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/agent/threads/${id}/messages`, { cache: "no-store", headers: authHeaders() });
      const data = await res.json();
      const restored: Message[] = (data?.messages ?? []).map((m: RawStoredMessage): Message => {
        if (m.kind === "tool") {
          return {
            kind: "tool",
            tool: m.meta?.tool ?? m.role,
            summary: m.content,
            ok: Boolean(m.meta?.ok),
            durationMs: m.meta?.durationMs,
            preview: m.meta?.preview,
            clipped: Boolean(m.meta?.clipped),
          };
        }
        if (m.role === "user") return { kind: "msg", sender: "user", text: m.content };
        if (m.role === "assistant") return { kind: "msg", sender: "cfo", text: m.content };
        return { kind: "msg", sender: "cfo", text: m.content };
      });
      setMessages(
        restored.length
          ? restored
          : [
              {
                kind: "msg",
                sender: "cfo",
                text:
                  "I'm your treasury assistant. Ask me which offer wins and why, which is cheapest, why an offer was disqualified, what this supplier needs and by when, or whether the ledger balances.",
              },
            ],
      );
    } catch {
      setMessages([
        {
          kind: "msg",
          sender: "cfo",
          text:
            "I'm your treasury assistant. Ask me which offer wins and why, which is cheapest, why an offer was disqualified, what this supplier needs and by when, or whether the ledger balances.",
        },
      ]);
    }
  }, []);

  const ensureThread = useCallback(async () => {
    let id = threadId ?? (typeof window !== "undefined" ? localStorage.getItem(THREAD_KEY) : null);
    if (!id) {
      const res = await fetch("/api/agent/threads", { method: "POST", headers: authHeaders() });
      const data = await res.json();
      id = data?.id ?? null;
      if (id && typeof window !== "undefined") localStorage.setItem(THREAD_KEY, id);
    }
    if (!id) return; // creation failed; the chat still works in-memory
    setThreadId(id);
    await restoreHistory(id);
    await loadThreads();
  }, [threadId, restoreHistory, loadThreads]);

  // On open, (re)establish the thread once and pull history.
  useEffect(() => {
    if (isOpen && !threadInit.current) {
      threadInit.current = true;
      void ensureThread();
    }
  }, [isOpen, ensureThread]);

  const newChat = useCallback(async () => {
    const res = await fetch("/api/agent/threads", { method: "POST", headers: authHeaders() });
    const data = await res.json();
    const id = data?.id;
    if (id) {
      if (typeof window !== "undefined") localStorage.setItem(THREAD_KEY, id);
      setThreadId(id);
      setApproval(null);
      setMessages([
        {
          kind: "msg",
          sender: "cfo",
          text:
            "New chat started. Ask me which offer wins and why, which is cheapest, why an offer was disqualified, what this supplier needs and by when, or whether the ledger balances.",
        },
      ]);
      await loadThreads();
    }
  }, [loadThreads]);

  const ask = useCallback(
    async (text: string, approvalInput?: { decision: "allow" | "deny"; tool?: string }) => {
      const question = text.trim();
      if ((!question && !approvalInput) || thinking) return;
      if (question) {
        setMessages((prev) => [...prev, { kind: "msg", sender: "user", text: question }]);
      }
      setUserQuery("");
      setThinking(true);
      finalText.current = "";
      pendingTools.current = {};
      const cfoId = crypto.randomUUID();

      const applyText = (delta: string) => {
        finalText.current += delta;
        setMessages((prev) => {
          if (!prev.some((m) => m.id === cfoId)) {
            return [...prev, { kind: "msg", sender: "cfo", text: delta, id: cfoId }];
          }
          return prev.map((m) =>
            m.id === cfoId ? { ...m, text: ((m as { text?: string }).text ?? "") + delta } : m,
          );
        });
      };

      const applyToolCall = (tool: string) => {
        const id = crypto.randomUUID();
        pendingTools.current[tool] = [...(pendingTools.current[tool] ?? []), id];
        setMessages((prev) => [
          ...prev,
          { kind: "tool", id, tool, summary: "calling…", ok: true, clipped: false },
        ]);
      };

      const applyTool = (tool: SanitizedTool) => {
        const queue = pendingTools.current[tool.tool] ?? [];
        const id = queue.shift();
        const card: Message = {
          kind: "tool",
          id,
          tool: tool.tool,
          summary: tool.summary,
          ok: tool.ok,
          durationMs: tool.durationMs,
          preview: tool.preview,
          clipped: tool.clipped,
        };
        setMessages((prev) => (id ? prev.map((m) => (m.id === id ? card : m)) : [...prev, card]));
      };

      try {
        const res = await fetch("/api/agent/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            question,
            opportunityId,
            agentType,
            threadId,
            approval: approvalInput,
          }),
        });
        if (!res.body) throw new Error("no_stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        interface SseData {
          delta?: string;
          tool?: string;
          args?: unknown;
          ok?: boolean;
          summary?: string;
          durationMs?: number;
          preview?: string;
          clipped?: boolean;
          threadId?: string;
          approvalRequest?: ApprovalRequest | null;
          message?: string;
          finishReason?: string;
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            const evLine = raw.split("\n").find((l) => l.startsWith("event:"));
            const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const event = evLine ? evLine.slice(6).trim() : "message";
            let data: SseData;
            try {
              data = JSON.parse(dataLine.slice(5).trim()) as SseData;
            } catch {
              continue;
            }
            if (event === "text") {
              applyText(data.delta ?? "");
            } else if (event === "tool-call") {
              applyToolCall(data.tool ?? "");
            } else if (event === "tool") {
              applyTool({
                tool: data.tool ?? "",
                ok: Boolean(data.ok),
                summary: data.summary ?? "",
                durationMs: data.durationMs,
                preview: data.preview,
                clipped: Boolean(data.clipped),
              });
            } else if (event === "done") {
              const tid = data?.threadId;
              if (tid && tid !== threadId) {
                setThreadId(tid);
                if (typeof window !== "undefined") localStorage.setItem(THREAD_KEY, tid);
              }
              if (data?.approvalRequest) setApproval(data.approvalRequest as ApprovalRequest);
              else setApproval(null);
            } else if (event === "error") {
              applyText(data?.message ?? "Something went wrong.");
            }
          }
        }

        void speak(finalText.current);
        void loadThreads();
      } catch {
        setMessages((prev) => [
          ...prev,
          { kind: "msg", sender: "cfo", text: "I could not reach the marketplace data just now." },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [agentType, opportunityId, threadId, speak, thinking, loadThreads],
  );

  const { start: startListening, stop: stopListening, listening: isListening, supported: micSupported, error: micError } =
    useMicrophone((t) => ask(t));

  const handleSendPrompt = (text: string) => void ask(text);

  useEffect(() => {
    if (!isOpen) {
      stopSpeaking();
      stopListening();
    }
  }, [isOpen, stopSpeaking, stopListening]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="fixed bottom-4 right-4 z-50 flex h-[78vh] w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowThreads((v) => !v)}
                title="Threads"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                {isSpeaking && <span className="absolute -inset-1 rounded-md border-2 border-emerald-500/40 animate-ping" />}
              </div>
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-slate-900 text-sm tracking-tight">
                  CFO Voice Cockpit
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200">
                    <Radio className="h-3 w-3 animate-pulse text-emerald-600" /> ElevenLabs
                  </span>
                </h3>
                <p className="text-xs text-slate-500">Autonomous Multi-Attribute Treasury Advisor</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Threads drawer */}
          <AnimatePresence>
            {showThreads && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-slate-200 bg-slate-50"
              >
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs font-semibold text-slate-600">Threads</span>
                  <button
                    onClick={() => void newChat()}
                    className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    <Plus className="h-3 w-3" /> New chat
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto px-2 pb-2 space-y-1">
                  {threads.length === 0 && <p className="px-2 text-xs text-slate-400">No threads yet.</p>}
                  {threads.map((t) => (
                    <button
                      key={t.id}
                      onClick={async () => {
                        setThreadId(t.id);
                        if (typeof window !== "undefined") localStorage.setItem(THREAD_KEY, t.id);
                        setApproval(null);
                        setShowThreads(false);
                        await restoreHistory(t.id);
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition ${
                        t.id === threadId ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span className="truncate">{t.title || "New chat"}</span>
                      <span className="ml-2 shrink-0 text-[10px] opacity-60">{t.messageCount}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent switcher */}
          <div className="flex gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2">
            <button
              onClick={() => setAgentType("treasury")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                agentType === "treasury" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> Treasury
            </button>
            <button
              onClick={() => setAgentType("audit")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                agentType === "audit" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Scale className="h-3.5 w-3.5" /> Audit
            </button>
          </div>

          {/* Audio Visualizer */}
          <div className="flex flex-col items-center justify-center py-4 px-4 bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center justify-center gap-1.5 h-10 w-full">
              {[30, 50, 75, 40, 65, 80, 55, 40, 70, 25, 75, 50, 30].map((height, i) => (
                <motion.div
                  key={i}
                  animate={isSpeaking || isListening ? { height: [8, height, 12, height * 0.7, 8] } : { height: 6 }}
                  transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.07, ease: "easeInOut" }}
                  className={`w-1.5 rounded-full ${isSpeaking ? "bg-emerald-600" : isListening ? "bg-slate-900" : "bg-slate-200"}`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {isSpeaking ? "Voice Agent Speaking..." : isListening ? "Listening to voice input..." : "Voice channel active. Tap microphone to speak."}
            </p>
          </div>

          {/* Conversation + tool calls */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, idx) => {
              if (m.kind === "tool") {
                return <ToolCallCard key={idx} call={m} />;
              }
              if (m.kind === "meta") {
                if (!m.traceId && !m.steps) return null;
                return (
                  <div key={idx} className="flex justify-start">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                      trace {m.traceId} · {m.steps ?? 0} steps
                    </span>
                  </div>
                );
              }
              return (
                <div key={idx} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3.5 py-2 text-xs leading-relaxed ${
                      m.sender === "user" ? "bg-[#0F172A] text-white" : "bg-slate-100 text-slate-900 border border-slate-200/60"
                    }`}
                  >
                    {m.sender === "cfo" ? <Markdown content={m.text} /> : m.text}
                  </div>
                </div>
              );
            })}

            {thinking && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-slate-100 px-3.5 py-2 text-xs text-slate-500 animate-pulse">
                  thinking & calling tools…
                </div>
              </div>
            )}

            {/* Human-in-the-loop approval prompt */}
            {approval && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs">
                <p className="font-medium text-amber-900">
                  Approve write action <span className="font-mono">{approval.tool}</span>?
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-amber-800">
                  {JSON.stringify(approval.args, null, 2)}
                </pre>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setApproval(null);
                      void ask("", { decision: "allow", tool: approval.tool });
                    }}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-white font-medium hover:bg-emerald-700"
                  >
                    Allow once
                  </button>
                  <button
                    onClick={() => {
                      setApproval(null);
                      void ask("", { decision: "allow", tool: approval.tool });
                    }}
                    className="rounded-md border border-emerald-600 px-3 py-1.5 text-emerald-700 font-medium hover:bg-emerald-50"
                  >
                    Allow always
                  </button>
                  <button
                    onClick={() => {
                      setApproval(null);
                      void ask("", { decision: "deny", tool: approval.tool });
                    }}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 font-medium hover:bg-slate-100"
                  >
                    Deny
                  </button>
                </div>
              </div>
            )}
          </div>

          {(speechError || micError) && (
            <div className="border-t border-slate-200 bg-amber-50 px-4 py-2 text-[11px] leading-snug text-amber-800">
              {speechState === "unconfigured"
                ? "Voice output isn't configured here — answers still appear as text."
                : (micError ?? speechError)}
            </div>
          )}

          {/* Action Bar */}
          <div className="border-t border-slate-200 p-3 bg-white flex items-center gap-2">
            <button
              onClick={() => (isListening ? stopListening() : startListening())}
              disabled={!micSupported}
              title={micSupported ? "Ask by voice" : "This browser cannot listen — type instead"}
              className={`flex h-10 w-10 items-center justify-center rounded-md transition-all ${
                isListening ? "bg-red-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              {isListening ? <Mic className="h-4 w-4 animate-pulse" /> : <MicOff className="h-4 w-4" />}
            </button>
            <input
              type="text"
              placeholder={agentType === "audit" ? "Ask the audit agent…" : "Ask the treasury agent…"}
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendPrompt(userQuery)}
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
      )}
    </AnimatePresence>
  );
};

function ToolCallCard({ call }: { call: Extract<Message, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className={`inline-block h-2 w-2 rounded-full ${call.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span className="font-mono font-medium text-slate-800">{call.tool}</span>
        <span className="text-slate-500 line-clamp-1 flex-1 truncate">{call.summary}</span>
        {typeof call.durationMs === "number" && <span className="text-slate-400">{call.durationMs}ms</span>}
        <span className="ml-auto text-slate-400">{open ? "hide" : "details"}</span>
      </button>
      <p className="mt-1 text-slate-600">{call.summary}</p>
      {open && call.preview && (
        <div className="mt-1.5 rounded bg-white border border-slate-200 p-2">
          <span className="text-slate-400">sanitized result: </span>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-slate-600">
            {call.preview}
            {call.clipped ? "\n…(truncated)" : ""}
          </pre>
        </div>
      )}
    </div>
  );
}
