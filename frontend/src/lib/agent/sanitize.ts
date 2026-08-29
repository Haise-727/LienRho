// Sanitize + summarize tool calls for safe display and storage (#29).
//
// The raw tool output (full provider arrays, ledger dumps, opportunity lists)
// must never be shown or stored verbatim. This produces a one-line summary plus
// a redacted, truncated preview. The hot path returns this to the UI; the cold
// path stores it. Redaction: long strings are masked, large arrays are capped,
// and the preview is hard-truncated so nothing huge ever leaves the server.

import type { SanitizedToolCall, ToolCallDetail } from "./types";

const PREVIEW_CAP = 600; // chars
const ARRAY_CAP = 3; // items kept per array

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 80 ? value.slice(0, 80) + "…" : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return depth > 2 ? `[${value.length} items]` : value.slice(0, ARRAY_CAP).map((v) => redact(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function summarize(call: ToolCallDetail): string {
  const out = call.result as Record<string, unknown> | undefined;
  if (out && typeof out.summary === "string" && out.summary.trim()) {
    return out.summary.trim();
  }
  return call.ok ? `Ran ${call.tool}.` : `Failed: ${call.tool}.`;
}

export function sanitizeToolCall(call: ToolCallDetail): SanitizedToolCall {
  const summary = summarize(call);
  const previewObj: Record<string, unknown> = { args: redact(call.args) };
  const out = call.result as Record<string, unknown> | undefined;
  // Prefer the human summary over dumping the raw object.
  if (out && typeof out.summary !== "string") previewObj.result = redact(out);
  const preview = JSON.stringify(previewObj);
  const clipped = preview.length > PREVIEW_CAP || JSON.stringify(call.result ?? {}).length > PREVIEW_CAP;

  return {
    tool: call.tool,
    ok: call.ok,
    durationMs: call.durationMs,
    summary,
    clipped,
    preview: clipped ? preview.slice(0, PREVIEW_CAP) + "…" : preview,
  };
}

export function sanitizeToolCalls(calls: ToolCallDetail[]): SanitizedToolCall[] {
  return calls.map(sanitizeToolCall);
}
