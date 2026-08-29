// Load the full message history (incl. tool cards) for a thread, so the cockpit
// can restore a conversation after reload.

import { loadFullHistory } from "@/lib/agent/threads";
import { resolveUserId } from "@/lib/agent/user";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "bad_request" }, { status: 400 });

  // Multi-tenant guard: only the thread's owner may read it.
  const userId = resolveUserId(request);
  const thread = await prisma.agentThread.findUnique({ where: { id }, select: { userId: true } });
  if (!thread) return Response.json({ error: "not_found" }, { status: 404 });
  if (thread.userId && thread.userId !== userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const messages = await loadFullHistory(id);
  return Response.json({ threadId: id, messages });
}
