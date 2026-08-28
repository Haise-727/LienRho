// JSON serialisation for ledger and marketplace payloads.
//
// Prisma.Decimal does not survive JSON.stringify as anything useful (you get
// `{ s, e, d }`), and re-parsing money as a JS number reintroduces exactly the
// float error the Decimal columns exist to avoid. Amounts therefore cross the
// wire as fixed-precision *strings*, and clients that need arithmetic should
// parse them with a decimal library rather than Number().

import { Prisma } from "@/generated/prisma/client";

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Recursively convert Decimals to fixed strings and Dates to ISO-8601. */
export function toJson(value: unknown): Json {
  if (value === null || value === undefined) return null;

  if (value instanceof Prisma.Decimal) {
    // Money keeps 2dp; rates and scores keep whatever precision they carry.
    return value.toString();
  }
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) return value.map(toJson);

  if (typeof value === "object") {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toJson(v);
    }
    return out;
  }

  if (typeof value === "bigint") return value.toString();
  return value as Json;
}

/** Uniform error body, so every route fails the same shape. */
export function fail(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}
