import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI (db push, migrate, seed) needs a *direct* connection: Supabase's
// pooler on 6543 runs in transaction mode and cannot execute DDL. The app
// runtime is the opposite — it wants the pooled URL, and gets it from
// DATABASE_URL via the driver adapter in src/lib/db.ts.
const cliUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!cliUrl) {
  throw new Error(
    "Neither DIRECT_URL nor DATABASE_URL is set. Copy .env.example to .env and fill it in.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: { url: cliUrl },
});
