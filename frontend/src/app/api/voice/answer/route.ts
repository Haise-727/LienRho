// CFO Voice Cockpit answer endpoint — now backed by the agentic loop (#29, #3).
//
// Previously a static keyword→intent router. It is now the orchestrator: the
// model chooses which treasury tools to call, the tools return deterministic
// figures, and the model phrases the result. When no LLM is configured the route
// returns a clear, non-silent message instead of a misleading figure.
//
// The request/response shape is unchanged so the cockpit UI needs no edits:
//   POST { question, opportunityId?, sessionId? } -> { answer, intent?, toolCalls? }

import { runAgent, AgentUnavailableError } from "@/lib/agent/loop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let question: string;
  let opportunityId: string | undefined;
  let sessionId: string | undefined;

  try {
    const body = await request.json();
    question = String(body?.question ?? "").trim();
    opportunityId = body?.opportunityId ? String(body.opportunityId) : undefined;
    sessionId = body?.sessionId ? String(body.sessionId) : opportunityId;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  if (!question) return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    const result = await runAgent({ question, opportunityId, sessionId });
    return Response.json({
      intent: "agent",
      answer: result.answer,
      toolCalls: result.toolCalls,
    });
  } catch (e) {
    if (e instanceof AgentUnavailableError) {
      return Response.json({ intent: "agent", answer: e.message });
    }
    // Genuine data/runtime failure: keep the cockpit honest rather than silent.
    return Response.json({
      intent: "agent",
      answer: "I could not reach the marketplace data just now.",
      error: e instanceof Error ? e.message : "unknown_error",
    });
  }
}
