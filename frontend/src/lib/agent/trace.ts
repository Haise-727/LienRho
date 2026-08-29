// Minimal observability for the agent loop. No external dependency — just
// structured console logs gated behind AGENT_TRACE, plus a request-scoped trace
// id so a single turn's tool calls, steps and retries can be correlated in logs.

let counter = 0;

export interface AgentTrace {
  traceId: string;
  agentType: string;
  sessionId: string;
  startedAt: number;
  events: Array<{ t: number; level: "info" | "warn" | "error"; msg: string; data?: unknown }>;
}

export function newTrace(agentType: string, sessionId: string): AgentTrace {
  counter += 1;
  const traceId = `agt_${Date.now().toString(36)}_${counter.toString(36)}`;
  return { traceId, agentType, sessionId, startedAt: Date.now(), events: [] };
}

function enabled(): boolean {
  return process.env.AGENT_TRACE === "1" || process.env.NODE_ENV === "development";
}

export function logTrace(trace: AgentTrace, level: "info" | "warn" | "error", msg: string, data?: unknown): void {
  const elapsed = Date.now() - trace.startedAt;
  trace.events.push({ t: elapsed, level, msg, data });
  if (!enabled()) return;
  const prefix = `[agent ${trace.traceId} +${elapsed}ms]`;
  if (level === "error") console.error(prefix, msg, data ?? "");
  else if (level === "warn") console.warn(prefix, msg, data ?? "");
  else console.log(prefix, msg, data ?? "");
}
