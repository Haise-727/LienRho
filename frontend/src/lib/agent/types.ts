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

export interface AgentInput {
  question: string;
  opportunityId?: string;
  /** Groups conversation turns so the agent remembers prior context. */
  sessionId?: string;
}

export interface ToolCallRecord {
  tool: string;
  args: unknown;
  ok: boolean;
}

export interface AgentResult {
  answer: string;
  intent: "agent";
  toolCalls: ToolCallRecord[];
}

export type { ModelMessage };
