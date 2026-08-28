// Guardrails for the CFO agent.
//
// Two kinds of boundary:
//  1. Source-of-truth: every rupee figure, rate, date and gate outcome the agent
//     speaks must come from a tool result, never from the model's memory. This is
//     enforced structurally (tools return `summary` strings the model relays) and
//     re-stated in the system prompt below.
//  2. Action safety: write tools only run when the caller passes `confirmed:
//     true`. `guardWriteAction` is the concrete gate the write tool consults
//     before touching anything.

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
  if (!confirmed) {
    return {
      allowed: false,
      reason:
        "Write action blocked: confirmation required. Ask the user to confirm before approving or rejecting.",
    };
  }
  return { allowed: true };
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
