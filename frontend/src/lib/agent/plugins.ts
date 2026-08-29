// Plugin registry — the extensibility seam for the agent.
//
// A plugin contributes a ToolSet and/or a set of skills. The orchestrator loads
// every registered plugin, so new capabilities are added by registering a plugin
// rather than editing the loop. The treasury plugin carries the core market tools
// plus the audit skill; future integrations (KYC, risk models, external CRMs)
// slot in here without touching loop.ts.

import type { Plugin, Skill } from "./types";
import { treasuryTools } from "./tools";
import { skills as treasurySkills } from "./skills";

export const treasuryPlugin: Plugin = {
  name: "treasury",
  description: "Core working-capital marketplace tools and audit skill.",
  tools: treasuryTools,
  skills: treasurySkills,
};

const registry: Plugin[] = [treasuryPlugin];

/** All registered plugins. */
export function getPlugins(): Plugin[] {
  return registry;
}

/** Merge every plugin's tools into one ToolSet for the model. */
export function collectTools(): Record<string, unknown> {
  const tools: Record<string, unknown> = {};
  for (const plugin of registry) {
    if (!plugin.tools) continue;
    for (const [name, def] of Object.entries(plugin.tools)) {
      tools[name] = def;
    }
  }
  return tools;
}

/** All skill definitions across plugins, for the system prompt. */
export function collectSkills(): Skill[] {
  return registry.flatMap((p) => p.skills ?? []);
}
