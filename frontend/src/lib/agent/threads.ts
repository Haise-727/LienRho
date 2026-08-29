// Thread + message persistence for the CFO Voice Cockpit (#29).
//
// Replaces the old single flat `agentMemory` table with proper chatbot-style
// threads: each conversation is a thread, messages are stored verbatim (user /
// assistant / tool / system), and a compacted `importantContext` line is
// maintained so key facts survive the sliding window ("don't lose important").
//
// Reads (hot path) are cheap. Writes are issued from the route handler's
// `after()` callback (cold path) so they never delay the user's answer.

import { prisma } from "@/lib/db";
import type { MemoryEntry } from "./types";

const DEFAULT_WINDOW = Number(process.env.NEXT_PUBLIC_AGENT_MEMORY_WINDOW) || 12;
const MAX_CONTEXT_LINES = 12;

/** Get an existing thread or create a fresh one. Returns the thread id. */
export async function getOrCreateThread(threadId?: string, userId?: string): Promise<string> {
  if (threadId) {
    const existing = await prisma.agentThread.findUnique({ where: { id: threadId } });
    if (existing) return existing.id;
  }
  const created = await prisma.agentThread.create({ data: { userId: userId ?? null } });
  return created.id;
}

/** List recent threads (id, title, updatedAt, message count) for the sidebar. */
export async function listThreads(
  limit = 20,
  userId?: string,
): Promise<Array<{ id: string; title: string; updatedAt: Date; messageCount: number }>> {
  const rows = await prisma.agentThread.findMany({
    where: userId ? { userId } : {},
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt,
    messageCount: r._count.messages,
  }));
}

/** Load the trailing window of user/assistant turns for the model context. */
export async function loadMemory(
  threadId: string,
  windowSize: number = DEFAULT_WINDOW,
): Promise<MemoryEntry[]> {
  const rows = await prisma.agentMessage.findMany({
    where: { threadId, role: { in: ["user", "assistant"] } },
    orderBy: { seq: "desc" },
    take: windowSize,
  });
  rows.reverse();
  return rows.map((r) => ({ role: r.role as MemoryEntry["role"], content: r.content }));
}

/** Full history (incl. tool cards) for restoring a thread in the UI. */
export async function loadFullHistory(threadId: string): Promise<
  Array<{ role: string; kind: string; content: string; meta: unknown }>
> {
  const rows = await prisma.agentMessage.findMany({
    where: { threadId },
    orderBy: { seq: "asc" },
  });
  return rows.map((r) => ({ role: r.role, kind: r.kind, content: r.content, meta: r.meta }));
}

/** Persist one message and bump the thread's timestamps (cold path). */
export async function appendMessage(
  threadId: string,
  role: string,
  content: string,
  kind = "msg",
  meta?: unknown,
): Promise<void> {
  await prisma.agentMessage.create({
    data: { threadId, role, content, kind, meta: meta === undefined ? undefined : (meta as object) },
  });
  await prisma.agentThread.update({
    where: { id: threadId },
    data: { lastMessageAt: new Date(), ...(role === "user" ? await autoTitle(threadId, content) : {}) },
  });
}

/** On the first user turn, derive a short title from the question. */
async function autoTitle(
  threadId: string,
  firstUserContent: string,
): Promise<{ title?: string }> {
  const thread = await prisma.agentThread.findUnique({
    where: { id: threadId },
    select: { title: true, _count: { select: { messages: true } } },
  });
  if (thread && thread.title === "New chat" && thread._count.messages <= 1) {
    const title = firstUserContent.trim().slice(0, 48) || "New chat";
    return { title };
  }
  return {};
}

/** Read the compacted long-term context for a thread. */
export async function getImportantContext(threadId: string): Promise<string> {
  const t = await prisma.agentThread.findUnique({
    where: { id: threadId },
    select: { importantContext: true },
  });
  return t?.importantContext ?? "";
}

/** Append a compact note to long-term context, keeping only the last N lines. */
export async function appendImportantContext(threadId: string, note: string): Promise<void> {
  const current = await getImportantContext(threadId);
  const lines = current ? current.split("\n").filter(Boolean) : [];
  lines.push(note.trim());
  const trimmed = lines.slice(-MAX_CONTEXT_LINES);
  await prisma.agentThread.update({
    where: { id: threadId },
    data: { importantContext: trimmed.join("\n") },
  });
}
