// Durable agent memory, backed by the Supabase Postgres database (#29).
//
// Replaces the previous in-process Map so a conversation's context survives
// across serverless instance restarts and is queryable like any other table.
// One row per message; read back in creation order for a session. The Prisma
// client targets the Supabase Postgres connection (DATABASE_URL), so this is the
// agent's persistent store on Supabase.

import { prisma } from "@/lib/db";
import type { MemoryEntry } from "./types";

const WINDOW = 12; // only the most recent turns are returned to the model

function key(sessionId?: string): string {
  return sessionId && sessionId.length > 0 ? sessionId : "default";
}

/** Load the recent turns for a session, oldest first. */
export async function loadMemory(sessionId?: string): Promise<MemoryEntry[]> {
  const rows = await prisma.agentMemory.findMany({
    where: { sessionId: key(sessionId) },
    orderBy: { seq: "asc" },
    take: WINDOW,
  });
  // Return the trailing window so very long sessions do not blow up the prompt.
  const sliced = rows.slice(-WINDOW);
  return sliced.map((r) => ({ role: r.role as MemoryEntry["role"], content: r.content }));
}

/** Append a turn and keep the stored history bounded. */
export async function appendTurn(
  sessionId: string | undefined,
  role: MemoryEntry["role"],
  content: string,
): Promise<void> {
  const k = key(sessionId);
  await prisma.agentMemory.create({ data: { sessionId: k, role, content } });
  // Bound storage: delete the oldest rows beyond the window for this session.
  const count = await prisma.agentMemory.count({ where: { sessionId: k } });
  if (count > WINDOW) {
    const excess = await prisma.agentMemory.findMany({
      where: { sessionId: k },
      orderBy: { seq: "asc" },
      take: count - WINDOW,
      select: { id: true },
    });
    await prisma.agentMemory.deleteMany({
      where: { id: { in: excess.map((e) => e.id) } },
    });
  }
}

/** Reset a session's memory. */
export async function clearMemory(sessionId?: string): Promise<void> {
  await prisma.agentMemory.deleteMany({ where: { sessionId: key(sessionId) } });
}
