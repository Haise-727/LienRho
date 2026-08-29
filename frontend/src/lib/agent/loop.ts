// The master agentic loop, built on the Vercel AI SDK.
//
// - Tools come from the registered plugin set (treasury/audit subsets in agents.ts).
// - Human-in-the-loop uses the SDK's native `toolApproval`: the write tool
//   (`executeDecision`) is flagged 'user-approval', so it is NOT executed until
//   the caller signals allow-once / allow-always / deny via `input.approval`.
// - Retries (p-retry, exponential backoff) wrap the model call.
// - Conversation memory is loaded from the sliding-window store.

import { generateText, isStepCount, type ModelMessage, type ToolSet, type ToolApprovalStatus } from "ai";
import { z } from "zod";
import { tool } from "ai";
import { getAgentModel, type AgentModel } from "./provider";
import { safeToolResult } from "./guardrails";
import { isWriteTool } from "./guardrails";
import { loadMemory, getImportantContext } from "./threads";
import { findSkill } from "./skills";
import { withRetry } from "./retry";
import { sanitizeToolCalls } from "./sanitize";
import { getAgentConfig, type AgentType, type AgentConfig } from "./agents";
import { newTrace, logTrace } from "./trace";
import type { AgentInput, AgentResult, ToolCallDetail } from "./types";

export class AgentUnavailableError extends Error {}

export function skillRunnerTool() {
  return tool({
    description:
      "Run a named skill playbook (e.g. auditAuction). Use when the user asks for an audit, review, or walk-through of a deal.",
    inputSchema: z.object({
      skill: z.string().describe("Skill name, e.g. 'auditAuction'"),
      opportunityId: z.string().optional(),
    }),
    execute: async ({ skill, opportunityId }) => {
      const s = findSkill(skill);
      if (!s?.run) return { error: `No executable skill named '${skill}'.` };
      return safeToolResult(await s.run({ opportunityId }));
    },
  });
}

function memoryToMessages(turns: { role: "user" | "assistant"; content: string }[]): ModelMessage[] {
  return turns.map((t) => ({ role: t.role, content: t.content }) as ModelMessage);
}

export interface AgentContext {
  agent: AgentModel;
  config: AgentConfig;
  tools: ToolSet;
  system: string;
  messages: ModelMessage[];
  toolApproval: (opts: { toolCall: { toolName: string } }) => ToolApprovalStatus;
  maxSteps: number;
  threadId: string;
}

/** Shared assembly of the agent call (model, tools, system, memory, approvals).
 *  Reused by the non-streaming `runAgent` and the streaming endpoint so the two
 *  paths can never diverge in behaviour. */
export async function buildAgentContext(input: AgentInput): Promise<AgentContext> {
  const agent = getAgentModel();
  if (!agent) {
    throw new AgentUnavailableError(
      "Treasury agent is not configured. Set NEXUS_LLM_BASE_URL, NEXUS_LLM_API_KEY and NEXUS_LLM_MODEL in frontend/.env.",
    );
  }

  const agentType: AgentType = input.agentType ?? "treasury";
  const config = getAgentConfig(agentType);
  const maxSteps = input.maxSteps ?? config.maxSteps;
  const threadId = input.threadId || input.sessionId || "default";

  const tools: ToolSet = { ...config.tools, runSkill: skillRunnerTool() };

  // Prepend compacted long-term memory so important facts survive the window.
  const importantContext = await getImportantContext(threadId);
  const system = importantContext
    ? `Important context carried from earlier in this conversation:\n${importantContext}\n\n${config.systemPrompt}`
    : config.systemPrompt;

  const prior = await loadMemory(threadId);
  const messages: ModelMessage[] = [
    ...memoryToMessages(prior),
    { role: "user", content: input.question } as ModelMessage,
  ];

  // SDK-native human-in-the-loop:
  //  - 'user-approval'  -> tool is held; we surface it to the UI for allow/deny
  //  - 'approved'       -> auto-run (allow-once / allow-always already granted)
  //  - 'not-applicable' -> read-only tools run immediately
  const toolApproval = (opts: { toolCall: { toolName: string } }): ToolApprovalStatus => {
    if (!isWriteTool(opts.toolCall.toolName)) return "not-applicable";
    if (input.approval?.decision === "allow") return "approved";
    return { type: "user-approval", reason: "Approve or reject this financing decision." };
  };

  return { agent, config, tools, system, messages, toolApproval, maxSteps, threadId };
}

export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const trace = newTrace(input.agentType ?? "treasury", input.threadId || input.sessionId || "default");
  logTrace(trace, "info", "runAgent:start", { question: input.question });

  let ctx: AgentContext;
  try {
    ctx = await buildAgentContext(input);
  } catch (e) {
    if (e instanceof AgentUnavailableError) {
      const message = e.message;
      logTrace(trace, "error", "runAgent:unavailable", { message });
      return {
        answer: message,
        intent: "agent",
        agentType: input.agentType ?? "treasury",
        threadId: input.threadId || input.sessionId || "default",
        toolCalls: [],
        traceId: trace.traceId,
        steps: 0,
      };
    }
    throw e;
  }

  const { agent, config, tools, system, messages, toolApproval, maxSteps, threadId } = ctx;
  const agentType = config.type;
  logTrace(trace, "info", "runAgent:start", { maxSteps, threadId });

  let result;
  let steps = 0;
  try {
    result = await withRetry(
      () =>
        generateText({
          model: agent.model,
          system,
          messages,
          tools,
          stopWhen: isStepCount(maxSteps),
          temperature: 0.3,
          toolApproval,
          onStepFinish: (step) => {
            steps = step.stepNumber;
            const calls = step.toolCalls ?? [];
            for (const tc of calls) {
              logTrace(trace, "info", `tool:${tc.toolName}`, { args: (tc as { input?: unknown }).input });
            }
            const results = step.toolResults ?? [];
            for (const tr of results) {
              const isError = (tr as { type?: string }).type === "tool-error";
              logTrace(trace, isError ? "warn" : "info", `tool-result:${tr.toolName}`, {
                ok: !isError,
              });
            }
          },
        }),
      {
        retries: 2,
        onRetry: (attempt) => logTrace(trace, "warn", `retry:attempt${attempt}`),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    logTrace(trace, "error", "runAgent:failed", { message });
    const answer = `I could not reach the marketplace data just now. (${message})`;
    // Persistence happens in the route's after() cold path.
    return { answer, intent: "agent", agentType, threadId, toolCalls: [], traceId: trace.traceId, steps };
  }

  const answer = result.text?.trim() || "I could not reach the marketplace data just now.";

  const toolCallDetails: ToolCallDetail[] = (result.toolCalls ?? []).map((tc) => {
    const res = (result.toolResults ?? []).find((r) => r.toolCallId === tc.toolCallId);
    const started = trace.events.find((e) => e.msg === `tool:${tc.toolName}`);
    const finished = trace.events.find((e) => e.msg === `tool-result:${tc.toolName}`);
    const durationMs =
      started && finished ? finished.t - started.t : undefined;
    return {
      tool: tc.toolName,
      args: (tc as { input?: unknown }).input,
      result: (res as { output?: unknown } | undefined)?.output,
      ok: Boolean(res),
      durationMs,
    };
  });

  logTrace(trace, "info", "runAgent:done", {
    steps,
    toolCalls: toolCallDetails.length,
    heldForApproval: toolCallDetails.some((d) => isWriteTool(d.tool) && !d.ok),
  });

  // A held write tool = pending human approval.
  const pending = toolCallDetails.find((d) => isWriteTool(d.tool) && !d.ok);

  return {
    answer,
    intent: "agent",
    agentType,
    threadId,
    // Sanitized + summarized for the UI; the raw dump is never returned.
    toolCalls: sanitizeToolCalls(toolCallDetails),
    traceId: trace.traceId,
    steps,
    approvalRequest: pending
      ? { tool: pending.tool, args: pending.args, threadId }
      : undefined,
  };
}