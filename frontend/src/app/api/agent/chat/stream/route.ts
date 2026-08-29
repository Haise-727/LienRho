// CFO Voice Cockpit — streaming answer endpoint (SSE).
//
// Hot path: stream the model's text tokens + sanitized tool-call events to the
// browser as Server-Sent Events, using the Vercel AI SDK's `streamText` +
// `fullStream` (the same streaming protocol pattern the AI SDK / chat starters
// use). Cold path: an `after()` callback persists the turn (thread + messages),
// archives sanitized tool-call records, and compacts long-term context — none of
// which blocks the stream.
//
//   POST { question, opportunityId?, threadId?, agentType?, approval?, userId? }
//     -> text/event-stream of:
//          event: text       { delta }
//          event: tool-call  { tool, args }
//          event: tool        { tool, ok, summary, durationMs, preview, clipped }
//          event: done       { threadId, approvalRequest? }
//          event: error      { message }

import { after } from "next/server";
import { streamText, isStepCount } from "ai";
import {
  buildAgentContext,
  AgentUnavailableError,
  type AgentContext,
} from "@/lib/agent/loop";
import { isWriteTool } from "@/lib/agent/guardrails";
import { sanitizeToolCall } from "@/lib/agent/sanitize";
import {
  getOrCreateThread,
  appendMessage,
  appendImportantContext,
} from "@/lib/agent/threads";
import { resolveUserId } from "@/lib/agent/user";
import type { AgentInput, ToolCallDetail } from "@/lib/agent/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function unavailableStream(message: string, threadId: string | null): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sse("text", { delta: message }));
      controller.enqueue(sse("done", { threadId, approvalRequest: null }));
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

export async function POST(request: Request) {
  let question: string;
  let opportunityId: string | undefined;
  let threadId: string | undefined;
  let agentType: "treasury" | "audit" | undefined;
  let approval: { decision: "allow" | "deny"; tool?: string } | undefined;
  let userId = "anonymous";

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
    userId = String(body?.userId ?? "").trim() || resolveUserId(request);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  if (!question && !approval) return Response.json({ error: "bad_request" }, { status: 400 });

  const modelQuestion =
    question || (approval ? "(The user approved the pending financing action — please proceed and finalize.)" : "");

  let ctx: AgentContext;
  try {
    const input: AgentInput = { question: modelQuestion, opportunityId, threadId, agentType, approval };
    ctx = await buildAgentContext(input);
  } catch (e) {
    if (e instanceof AgentUnavailableError) {
      return unavailableStream(e.message, threadId ?? null);
    }
    return Response.json({ error: "agent_error" }, { status: 500 });
  }

  const effectiveThreadId = await getOrCreateThread(threadId, userId);
  const askedApproval = approval?.decision === "allow";

  const result = streamText({
    model: ctx.agent.model,
    system: ctx.system,
    messages: ctx.messages,
    tools: ctx.tools,
    stopWhen: isStepCount(ctx.maxSteps),
    temperature: 0.3,
    toolApproval: ctx.toolApproval,
  });

  // ---- accumulate for the cold-path persistence ----
  let fullText = "";
  const toolCalls = new Map<string, { tool: string; args: unknown; t: number }>();
  const toolResults: ToolCallDetail[] = [];
  let pendingApproval: { tool: string; args: unknown; threadId: string } | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          switch (part.type) {
            case "text-delta": {
              fullText += part.text;
              controller.enqueue(sse("text", { delta: part.text }));
              break;
            }
            case "tool-call": {
              toolCalls.set(part.toolCallId, {
                tool: part.toolName,
                args: (part as { input?: unknown }).input,
                t: Date.now(),
              });
              controller.enqueue(sse("tool-call", { tool: part.toolName, args: (part as { input?: unknown }).input }));
              break;
            }
            case "tool-result": {
              const started = toolCalls.get(part.toolCallId);
              const durationMs = started ? Date.now() - started.t : undefined;
              const raw =
                (part as { output?: unknown; errorText?: string }).errorText ??
                (part as { output?: unknown }).output;
              const isError =
                raw != null &&
                typeof raw === "object" &&
                (raw as { type?: string }).type === "tool-error";
              const detail: ToolCallDetail = {
                tool: started?.tool ?? (part as { toolName: string }).toolName,
                args: started?.args,
                result: raw,
                ok: !isError,
                durationMs,
              };
              toolResults.push(detail);
              const s = sanitizeToolCall(detail);
              controller.enqueue(
                sse("tool", {
                  tool: s.tool,
                  ok: s.ok,
                  summary: s.summary,
                  durationMs: s.durationMs,
                  preview: s.preview,
                  clipped: s.clipped,
                }),
              );
              break;
            }
            case "finish": {
              controller.enqueue(sse("finish", { finishReason: (part as { finishReason?: string }).finishReason }));
              break;
            }
            case "error": {
              controller.enqueue(sse("error", { message: (part as { errorText?: string }).errorText ?? "stream error" }));
              break;
            }
            default:
              break;
          }
        }

        // Detect a held write tool -> surface as a human-approval request.
        if (!askedApproval) {
          const writeCalled = [...toolCalls.values()].filter((v) => isWriteTool(v.tool));
          const writeResolved = toolResults.filter((d) => isWriteTool(d.tool));
          if (writeCalled.length > writeResolved.length) {
            const held = writeCalled[0];
            pendingApproval = { tool: held.tool, args: held.args, threadId: effectiveThreadId };
          }
        }

        controller.enqueue(
          sse("done", {
            threadId: effectiveThreadId,
            approvalRequest: pendingApproval,
          }),
        );
      } catch (err) {
        controller.enqueue(sse("error", { message: err instanceof Error ? err.message : "stream error" }));
      } finally {
        controller.close();
      }
    },
  });

  // ---- cold path: persist + sanitize after the response is sent ----
  after(async () => {
    try {
      const tid = effectiveThreadId;
      if (question) await appendMessage(tid, "user", question);
      for (const d of toolResults) {
        const s = sanitizeToolCall(d);
        await appendMessage(tid, "tool", s.summary, "tool", {
          tool: s.tool,
          ok: s.ok,
          durationMs: s.durationMs,
          preview: s.preview,
          clipped: s.clipped,
        });
      }
      if (fullText.trim()) await appendMessage(tid, "assistant", fullText.trim());
      const oneLiner = `${question ? `Q: ${question.slice(0, 80)} | ` : ""}A: ${fullText.trim().slice(0, 80)}`;
      await appendImportantContext(tid, oneLiner);
    } catch (err) {
      console.error("[agent:after] persistence failed", err);
    }
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
