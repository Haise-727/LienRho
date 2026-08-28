// The master agentic loop.
//
// Assembles the model, the registered plugin tools, the skill runner, and the
// guardrail system prompt, then runs a tool-calling loop (up to N steps) to
// answer one question. All factual content comes from tool results; the model
// only decides which tools to call and how to phrase the outcome. Conversation
// memory is threaded in from the memory store so the agent is not stateless.

import { generateText, stepCountIs, type ModelMessage, type ToolSet } from "ai";
import { z } from "zod";
import { tool } from "ai";
import { getAgentModel } from "./provider";
import { collectTools, collectSkills } from "./plugins";
import { GUARDRAIL_SYSTEM, safeToolResult } from "./guardrails";
import { loadMemory, appendTurn } from "./memory";
import { findSkill } from "./skills";
import type { AgentInput, AgentResult, ToolCallRecord } from "./types";

export class AgentUnavailableError extends Error {}

const MAX_STEPS = 5;

function buildSystemPrompt(): string {
  const skills = collectSkills() ?? [];
  const skillLines = skills
    .map((s) => `- ${s.name}: ${s.description}`)
    .join("\n");

  return [
    "You are the CFO Voice Cockpit treasury agent for LienRho, an agentic " +
      "working-capital marketplace. You help a CFO understand auctions, offers, " +
      "supplier cash needs, the ledger, and portfolio exposure, and can execute " +
      "an approve/reject decision when explicitly confirmed.",
    "",
    "AVAILABLE SKILLS (composite playbooks you may run with runSkill):",
    skillLines || "(none)",
    "",
    GUARDRAIL_SYSTEM,
  ].join("\n");
}

/** A generic tool that runs a named skill's `run` if it has one. */
function skillRunnerTool() {
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

export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const agent = getAgentModel();
  if (!agent) {
    throw new AgentUnavailableError(
      "Treasury agent is not configured. Set NEXUS_LLM_BASE_URL, NEXUS_LLM_API_KEY and NEXUS_LLM_MODEL in frontend/.env.",
    );
  }

  const tools = {
    ...(collectTools() as ToolSet),
    runSkill: skillRunnerTool(),
  };

  const system = buildSystemPrompt();
  const prior = loadMemory(input.sessionId);
  const messages: ModelMessage[] = [
    ...memoryToMessages(prior),
    { role: "user", content: input.question } as ModelMessage,
  ];

  const result = await generateText({
    model: agent.model,
    system,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    temperature: 0.3,
  });

  const answer = result.text?.trim() || "I could not reach the marketplace data just now.";

  const toolCalls: ToolCallRecord[] = (
    (result.toolCalls ?? []) as Array<{ toolName: string; args?: unknown }>
  ).map((tc) => ({
    tool: tc.toolName,
    args: tc.args ?? null,
    ok: true,
  }));

  appendTurn(input.sessionId, "user", input.question);
  appendTurn(input.sessionId, "assistant", answer);

  return { answer, intent: "agent", toolCalls };
}
