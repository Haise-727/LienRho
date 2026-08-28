// Short-term memory for the agent.
//
// A server-side map keyed by sessionId. The CFO cockpit is ephemeral and does
// not (yet) persist sessions, so this gives the agent continuity across turns
// within a session instead of treating every question as independent. The store
// keeps a rolling window so a long conversation cannot grow the prompt without
// bound.

import type { MemoryEntry } from "./types";

const WINDOW = 12; // keep at most this many recent turns

const store = new Map<string, MemoryEntry[]>();

function key(sessionId?: string): string {
  return sessionId && sessionId.length > 0 ? sessionId : "default";
}

/** Load the recent turns for a session (oldest first). */
export function loadMemory(sessionId?: string): MemoryEntry[] {
  return store.get(key(sessionId)) ?? [];
}

/** Append a user/assistant turn and trim to the rolling window. */
export function appendTurn(
  sessionId: string | undefined,
  role: MemoryEntry["role"],
  content: string,
): void {
  const k = key(sessionId);
  const turns = store.get(k) ?? [];
  turns.push({ role, content });
  while (turns.length > WINDOW) turns.shift();
  store.set(k, turns);
}

/** Reset a session's memory (used by an explicit "clear" intent). */
export function clearMemory(sessionId?: string): void {
  store.delete(key(sessionId));
}
