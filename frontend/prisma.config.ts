import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Supabase pools on 6543 (transaction mode) and cannot run DDL; db push
    // and migrations go direct on 5432.
    directUrl: env("DIRECT_URL"),
  },
});
