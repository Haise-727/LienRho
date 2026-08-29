// LLM transport for the CFO agentic loop.
//
// Points at the OpenAI-compatible NVIDIA NIM endpoint already provisioned for
// the (now-superseded) Python nexus layer. We reuse that key here so the
// frontend agent and the legacy ai/ agents share one entitlement. All config is
// env-driven (NEXUS_LLM_*) — nothing is hardcoded (AGENTS.md: zero hardcoding).

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export interface AgentModel {
  model: LanguageModel;
  modelId: string;
}

/**
 * Build the agent's language model, or null when the environment has no LLM
 * configured. Callers must treat null as "agent unavailable" and degrade
 * gracefully rather than throwing a mid-flight 500.
 */
export function getAgentModel(): AgentModel | null {
  const baseURL = process.env.NEXUS_LLM_BASE_URL;
  const apiKey = process.env.NEXUS_LLM_API_KEY;
  const modelId = process.env.NEXUS_LLM_MODEL;

  if (!baseURL || !apiKey || !modelId) return null;

  const provider = createOpenAI({ baseURL, apiKey });
  return { model: provider.chat(modelId), modelId };
}
