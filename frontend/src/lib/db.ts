// The Prisma client, as a singleton.
//
// Next.js dev reloads modules on every edit; constructing a client per reload
// exhausts the connection pool within a few saves (and Supabase's free tier is
// stingier than local Postgres about it). Stashing it on globalThis is the
// standard escape hatch — in production the module is evaluated once and the
// branch never matters.

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy frontend/.env.example to frontend/.env and fill it in.",
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Prisma 7 talks to Postgres through a driver adapter rather than a
    // connection URL in the schema.
    adapter: new PrismaPg({ connectionString }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
