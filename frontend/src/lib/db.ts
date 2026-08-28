// The Prisma client, as a lazy singleton.
//
// Next.js dev reloads modules on every edit; constructing a client per reload
// exhausts the connection pool within a few saves (and Supabase's free tier is
// stingier about that than local Postgres). Stashing it on globalThis is the
// standard escape hatch — in production the module is evaluated once and the
// branch never matters.
//
// Construction is deferred behind a Proxy so that merely *importing* this
// module never throws. Scripts and build-time imports that pull in a helper
// which happens to touch `prisma` should not die because DATABASE_URL was not
// set for them; only actually issuing a query should.

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy frontend/.env.example to frontend/.env and fill it in.",
    );
  }

  // Prisma 7 talks to Postgres through a driver adapter rather than a
  // connection URL in the schema.
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get: (_target, prop, receiver) => Reflect.get(getPrisma(), prop, receiver),
  has: (_target, prop) => prop in getPrisma(),
});
