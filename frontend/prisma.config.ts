import "dotenv/config";
import { defineConfig } from "prisma/config";

// Only the CLI commands that touch a database need a URL: db push, migrate,
// seed. `prisma generate` does not, and it runs on every `npm install` via
// postinstall — so this file must not throw when the environment is empty, or
// a fresh clone cannot install until someone has written a .env first. CI hit
// exactly that.
//
// When a URL is absent the datasource key is omitted entirely, and the
// commands that genuinely need one fail with Prisma's own message rather than
// a misleading config-load error.
//
// DIRECT_URL wins where both exist: Supabase's pooler on 6543 runs in
// transaction mode and cannot execute DDL. The app runtime is the opposite —
// it wants the pooled DATABASE_URL, which it gets through the driver adapter
// in src/lib/db.ts.
const cliUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  ...(cliUrl ? { datasource: { url: cliUrl } } : {}),
});
