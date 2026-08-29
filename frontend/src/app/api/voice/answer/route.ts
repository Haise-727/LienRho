// CFO Voice Cockpit answer endpoint — now backed by the agentic loop (#29, #3).
//
// Hot path: run the agent and return the answer + sanitized tool calls ASAP.
// Cold path: an `after()` callback persists the turn (thread + messages),
// archives a sanitized tool-call record, and compacts long-term context — none
// of which blocks the user's response.
//
//   POST { question, opportunityId?, threadId?, agentType?, approval? }
//     -> { answer, threadId, intent, toolCalls, traceId, steps, approvalRequest? }

import { after } from "next/server";
import { runAgent, AgentUnavailableError } from "@/lib/agent/loop";
import {
  getOrCreateThread,
  appendMessage,
  appendImportantContext,
} from "@/lib/agent/threads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let question: string;
  let opportunityId: string | undefined;
  let threadId: string | undefined;
  let agentType: "treasury" | "audit" | undefined;
  let approval: { decision: "allow" | "deny"; tool?: string } | undefined;

  try {
    const body = await request.json();
    question = String(body?.question ?? "").trim();
    opportunityId = body?.opportunityId ? String(body.opportunityId) : undefined;
    threadId = body?.threadId
      ? String(body.threadId)
      : body?.sessionId
        ? String(body.sessionId)
        : undefined;
    agentType = body?.agentType === "audit" ? "audit" : "treasury";
    if (body?.approval && (body.approval.decision === "allow" || body.approval.decision === "deny")) {
      approval = { decision: body.approval.decision, tool: body.approval.tool };
    }
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  if (!question && !approval) return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    const result = await runAgent({ question, opportunityId, threadId, agentType, approval });

    // Cold path: persist + sanitize in the background, after the response.
    const captured = { threadId: result.threadId, question, answer: result.answer, toolCalls: result.toolCalls };
    after(async () => {
      try {
        const tid = await getOrCreateThread(captured.threadId);
        if (captured.question) await appendMessage(tid, "user", captured.question);
        for (const tc of captured.toolCalls) {
          await appendMessage(tid, "tool", tc.summary, "tool", {
            tool: tc.tool,
            ok: tc.ok,
            durationMs: tc.durationMs,
            preview: tc.preview,
            clipped: tc.clipped,
          });
        }
        await appendMessage(tid, "assistant", captured.answer);
        // Compact one line of long-term memory so it survives the sliding window.
        const oneLiner = `${captured.question ? `Q: ${captured.question.slice(0, 80)} | ` : ""}A: ${captured.answer.slice(0, 80)}`;
        await appendImportantContext(tid, oneLiner);
      } catch (err) {
        // Background persistence must never crash the request; log and move on.
        console.error("[agent:after] persistence failed", err);
      }
    });

    return Response.json({
      intent: "agent",
      agentType: result.agentType,
      answer: result.answer,
      threadId: result.threadId,
      toolCalls: result.toolCalls,
      traceId: result.traceId,
      steps: result.steps,
      approvalRequest: result.approvalRequest,
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
