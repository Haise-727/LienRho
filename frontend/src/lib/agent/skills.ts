// Skills: reusable playbooks the orchestrator can run or recommend.
//
// A skill is higher-level than a single tool — it composes the primitive tools
// into a procedure the model can invoke as one step. They are described in the
// system prompt and, where a `run` is provided, can be executed directly by the
// orchestrator's runSkill tool.

import { clearById } from "@/lib/market/server";
import {
  resolveOpportunityId,
  winnerOf,
  cheapestOf,
  offerSummary,
} from "./clearing";
import { rupees } from "./format";
import type { Skill } from "./types";

export const auditAuction: Skill = {
  name: "auditAuction",
  description:
    "Full due-diligence pass on one auction: who wins, who is cheapest, what the supplier needs, and which offers were disqualified and why. Use when the user asks for an audit, review, or 'walk me through this deal'.",
  run: async ({ opportunityId }: { opportunityId?: string }) => {
    const id = await resolveOpportunityId(opportunityId);
    if (!id) return { summary: "There is no live auction to audit right now." };
    const result = await clearById(id);
    if (!result) return { summary: "I could not load that opportunity." };

    const winner = winnerOf(result);
    const cheapest = cheapestOf(result);
    const rejected = result.scoredOffers.filter((o) => o.disqualified);

    const lines: string[] = [];
    lines.push(
      result.status === "NO_ACCEPTABLE_OFFER"
        ? `No acceptable offer: ${result.reason}`
        : winner
          ? `Winner: ${offerSummary(winner)}`
          : "No winner cleared the gates.",
    );
    if (cheapest)
      lines.push(
        `Cheapest true cost: ${cheapest.providerName} at ${(cheapest.effectiveCostBps / 100).toFixed(2)} percent` +
          (cheapest.disqualified ? " (disqualified)." : "."),
      );
    if (!result.utility.unconstrained)
      lines.push(
        `Supplier needs ${rupees(result.utility.sufficiencyFloorPaise)} rupees by ${result.utility.timingDeadline}.`,
      );
    lines.push(
      rejected.length
        ? `Disqualified (${rejected.length}): ${rejected.map((o) => o.providerName).join(", ")}.`
        : "No offers were disqualified.",
    );
    return { summary: lines.join(" "), opportunityId: id };
  },
};

export const skills: Skill[] = [auditAuction];

/** Look up a registered skill by name (case-insensitive). */
export function findSkill(name: string): Skill | undefined {
  return skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
}
