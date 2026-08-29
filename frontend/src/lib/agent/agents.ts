import type { ToolSet } from "ai";
import { treasuryTools } from "./tools";
import { collectSkills } from "./plugins";
import { renderToolTeaching } from "./skills";

export type AgentType = "treasury" | "audit";

export interface AgentConfig {
  type: AgentType;
  label: string;
  description: string;
  systemPrompt: string;
  tools: ToolSet;
  maxSteps: number;
}

function listTools(toolSet: ToolSet): string {
  return Object.keys(toolSet)
    .map((name) => `- ${name}`)
    .join("\n");
}

function listSkills(): string {
  const skills = collectSkills() ?? [];
  return skills
    .map((s) => `- ${s.name}: ${s.description}`)
    .join("\n") || "(none)";
}

const baseGuard = `
GUARDRAILS — you must follow these exactly:
- Never state a rupee amount, percentage rate, date, or gate outcome that did not
  come from a tool result. If you need a number, call the appropriate tool.
- Do not invent opportunities, providers, or offers. If a tool returns nothing,
  say so plainly.
- Write actions require explicit user confirmation before execution.
- If you are unsure which auction the user means, call listOpportunities first.
- Keep answers concise and spoken-aloud friendly.
`;

const treasuryToolsSubset: ToolSet = {
  getWinningOffer: treasuryTools.getWinningOffer,
  getCheapestOffer: treasuryTools.getCheapestOffer,
  getSupplierNeed: treasuryTools.getSupplierNeed,
  getDisqualifiedOffers: treasuryTools.getDisqualifiedOffers,
  listOpportunities: treasuryTools.listOpportunities,
  getCashPosition: treasuryTools.getCashPosition,
  getInvoiceDetail: treasuryTools.getInvoiceDetail,
  getActionQueue: treasuryTools.getActionQueue,
  getVerificationStatus: treasuryTools.getVerificationStatus,
  executeDecision: treasuryTools.executeDecision,
  getProviderLiquidity: treasuryTools.getProviderLiquidity,
};

const auditToolsSubset: ToolSet = {
  getLedgerBalance: treasuryTools.getLedgerBalance,
  getPortfolioExposure: treasuryTools.getPortfolioExposure,
  getProviderLiquidity: treasuryTools.getProviderLiquidity,
  getVerificationStatus: treasuryTools.getVerificationStatus,
  getInvoiceDetail: treasuryTools.getInvoiceDetail,
  getDisqualifiedOffers: treasuryTools.getDisqualifiedOffers,
  getSupplierNeed: treasuryTools.getSupplierNeed,
};

export function getAgentConfig(type: AgentType): AgentConfig {
  if (type === "treasury") {
    return {
      type: "treasury",
      label: "Treasury Advisor",
      description: "Marketplace auctions, offers, supplier needs, and decisions",
      systemPrompt: [
        "You are the Treasury Advisor for LienRho, an agentic working-capital marketplace.",
        "You help a CFO understand live auctions, compare offers, evaluate supplier cash needs,",
        "and execute approve/reject decisions.",
        "",
        "AVAILABLE TOOLS:",
        listTools(treasuryToolsSubset),
        "",
        "AVAILABLE SKILLS:",
        listSkills(),
        "",
        "TOOL USAGE GUIDE — when to call each tool, what args to pass, and which to chain:",
        renderToolTeaching(Object.keys(treasuryToolsSubset)),
        "",
        baseGuard,
      ].join("\n"),
      tools: treasuryToolsSubset,
      maxSteps: 5,
    };
  }

  return {
    type: "audit",
    label: "Audit & Ledger Analyst",
    description: "Ledger balance, journal entries, portfolio exposure, and verification",
    systemPrompt: [
      "You are the Audit & Ledger Analyst for LienRho.",
      "You help a CFO or auditor understand the double-entry ledger, verify trial balances,",
      "review portfolio exposure across providers, and check invoice verification status.",
      "You do NOT execute approve/reject decisions — that is the Treasury Advisor's role.",
      "",
        "AVAILABLE TOOLS:",
        listTools(auditToolsSubset),
        "",
        "TOOL USAGE GUIDE — when to call each tool, what args to pass, and which to chain:",
        renderToolTeaching(Object.keys(auditToolsSubset)),
        "",
        baseGuard,
      ].join("\n"),
      tools: auditToolsSubset,
      maxSteps: 4,
  };
}