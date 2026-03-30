// Prisma CLI (migrate) uses DIRECT_URL when set (Supabase session/direct, port 5432).
// Runtime app uses DATABASE_URL (often the transaction pooler, port 6543 + pgbouncer=true).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const root = process.cwd();
loadEnv({ path: resolve(root, ".env") });
if (existsSync(resolve(root, ".env.local"))) {
  loadEnv({ path: resolve(root, ".env.local"), override: true });
}

const migrateUrl =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrateUrl,
  },
});
