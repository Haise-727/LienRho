// List recent CFO cockpit threads, or create a new one.

import { listThreads, getOrCreateThread } from "@/lib/agent/threads";
import { resolveUserId } from "@/lib/agent/user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = resolveUserId(request);
  const threads = await listThreads(20, userId);
  return Response.json({ threads });
}

export async function POST(request: Request) {
  const userId = resolveUserId(request);
  const id = await getOrCreateThread(undefined, userId);
  return Response.json({ id });
}
