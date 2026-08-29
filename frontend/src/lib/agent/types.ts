// Shared contracts for the CFO agentic layer.
//
// The agent is assembled from four cooperating parts, each with a single job:
//  - tools:    deterministic capabilities that do the real work (never the LLM)
//  - skills:   reusable playbooks the orchestrator can run or suggest
//  - plugins:  the extensibility seam — a plugin contributes tools and/or skills
//  - guardrails: boundaries the orchestrator enforces before/after tool calls
//  - memory:   short-term conversation state keyed by session

import type { ModelMessage, ToolSet } from "ai";

/** A turn of conversation, stored by the memory store. */
export interface MemoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface SkillContext {
  opportunityId?: string;
}

/**
 * A skill is a named playbook. `run`, when present, lets the orchestrator
 * execute it directly; otherwise the skill is described to the model in the
 * system prompt as a recipe it can follow with the available tools.
 */
export interface Skill {
  name: string;
  description: string;
  run?: (ctx: SkillContext) => Promise<unknown>;
}

/** A plugin is the unit of extensibility: register tools and/or skills. */
export interface Plugin {
  name: string;
  description: string;
  tools?: ToolSet;
  skills?: Skill[];
}

export type AgentType = "treasury" | "audit";

export interface AgentApproval {
  /** "allow" approves a held write action (allow-once or allow-always). */
  decision: "allow" | "deny";
  /** The tool call id / name being approved, for UI correlation. */
  tool?: string;
}

export interface AgentInput {
  question: string;
  /** Which agent personality to use. */
  agentType?: AgentType;
  opportunityId?: string;
  /** Conversation thread id. Groups turns so the agent remembers prior context
   *  and the cockpit can reload history. Falls back to `sessionId` for compat. */
  threadId?: string;
  /** Backwards-compatible alias for `threadId`. */
  sessionId?: string;
  /** Max tool-calling steps before the agent stops (default per-agent). */
  maxSteps?: number;
  /** Human-in-the-loop response for a pending write action. */
  approval?: AgentApproval;
}

/** A tool call as shown to the user: summarized + redacted, never the raw dump. */
export interface SanitizedToolCall {
  tool: string;
  ok: boolean;
  durationMs?: number;
  /** One-line human summary (e.g. "Listed 5 live auctions"). */
  summary: string;
  /** True when the underlying result was truncated for display. */
  clipped: boolean;
  /** Redacted preview of args/result (safe to log/render), truncated. */
  preview?: string;
}

export interface ToolCallDetail {
  tool: string;
  args: unknown;
  result?: unknown;
  ok: boolean;
  durationMs?: number;
}

export interface ApprovalRequest {
  tool: string;
  args: unknown;
  threadId: string;
}

export interface AgentResult {
  answer: string;
  intent: "agent";
  agentType: AgentType;
  toolCalls: SanitizedToolCall[];
  /** Thread this turn belongs to (created if the caller passed none). */
  threadId: string;
  /** Correlation id for server-side logs (set AGENT_TRACE=1 to see them). */
  traceId?: string;
  /** Number of model steps (tool-calling rounds) the turn took. */
  steps?: number;
  approvalRequest?: ApprovalRequest;
}

export type { ModelMessage };
