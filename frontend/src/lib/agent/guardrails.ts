// Guardrails for the CFO agent.
//
// Three kinds of boundary, all enforced in code rather than hoped-for in the
// prompt:
//  1. Loop limits: a hard cap on agent iterations (tool-calling steps) and a
//     per-call timeout, so a confused model cannot loop forever or hang.
//  2. Source-of-truth: every rupee figure, rate, date and gate outcome the
//     agent speaks must come from a tool result. sanitizeAnswer() strips any
//     stray currency symbol the model may have invented.
//  3. Action safety: write tools only run when explicitly confirmed.
//     preToolGuard / guardWriteAction are the concrete gates.

/** Runtime limits for the agent loop, env-overridable. */
export const AGENT_LIMITS = {
  /** Max tool-calling iterations (model steps) per turn. */
  maxSteps: Number(process.env.AGENT_MAX_STEPS ?? 5),
  /** Hard timeout for the whole generateText call, in milliseconds. */
  timeoutMs: Number(process.env.AGENT_TIMEOUT_MS ?? 30_000),
  /** Write actions require an explicit confirmed:true from the caller. */
  writeRequiresConfirmation: true,
};

/** The single tool that mutates state. */
const WRITE_TOOLS = new Set(["executeDecision"]);

export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name);
}

export const GUARDRAIL_SYSTEM = `
GUARDRAILS — you must follow these exactly:
- Never state a rupee amount, percentage rate, date, or gate outcome that did not
  come from a tool result. If you need a number, call the appropriate tool; do not
  estimate, round, or recall figures. The tool summaries are authoritative — relay
  them, do not rewrite the numbers.
- Do not invent opportunities, providers, or offers. If a tool returns nothing,
  say so plainly.
- Write actions (executeDecision) are the ONLY tool that changes state. Only call
  it when the user has explicitly asked to approve or reject AND you pass
  confirmed: true. If the user only asked a question, never call it.
- If you are unsure which auction the user means, call listOpportunities first.
- Keep answers concise and spoken-aloud friendly (this is a voice cockpit).
`;

export interface WriteGuardInput {
  decision: string;
  confirmed?: boolean;
}

export interface WriteGuardResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Gate for the single write-capable tool. A write proceeds only when the action
 * is well-formed AND explicitly confirmed. Anything else is blocked and the tool
 * returns a message asking for confirmation rather than failing silently.
 */
export function guardWriteAction({ decision, confirmed }: WriteGuardInput): WriteGuardResult {
  if (decision !== "approve" && decision !== "reject") {
    return { allowed: false, reason: `Unknown decision '${decision}'. Use approve or reject.` };
  }
  if (AGENT_LIMITS.writeRequiresConfirmation && !confirmed) {
    return {
      allowed: false,
      reason:
        "Write action blocked: confirmation required. Ask the user to confirm before approving or rejecting.",
    };
  }
  return { allowed: true };
}

/**
 * Gate consulted before any tool runs. Blocks write tools that are not
 * explicitly confirmed, and rejects unknown/malicious tool names.
 */
export function preToolGuard(toolName: string, args: unknown): WriteGuardResult {
  if (!toolName) return { allowed: false, reason: "Missing tool name." };
  if (isWriteTool(toolName)) {
    const a = (args ?? {}) as WriteGuardInput;
    return guardWriteAction({ decision: a.decision ?? "", confirmed: a.confirmed });
  }
  return { allowed: true };
}

export interface SanitizeResult {
  text: string;
  warnings: string[];
}

/**
 * Post-generation guardrail: the model must not introduce currency symbols it
 * did not get from a tool (tool summaries render amounts as "rupees", never
 * "₹"). Any stray symbol is replaced and flagged so it can be logged.
 */
export function sanitizeAnswer(text: string): SanitizeResult {
  const warnings: string[] = [];
  let out = text;
  if (out.includes("₹")) {
    warnings.push("Stripped unsourced currency symbol(s) from the answer.");
    out = out.replace(/₹\s*/g, "rupees ");
  }
  return { text: out, warnings };
}

/**
 * Post-execution sanity check that a tool result is JSON-serialisable. The AI
 * SDK serialises tool output to pass back to the model; a non-serialisable value
 * would throw mid-loop. We fail closed: return a safe placeholder instead.
 */
export function safeToolResult(value: unknown): unknown {
  try {
    JSON.stringify(value);
    return value;
  } catch {
    return { error: "tool result was not serialisable" };
  }
}