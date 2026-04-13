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
// e.g. PRISMA_ENV_FILE=.env.production.local npx prisma migrate deploy
// Strip prior DB URLs so .env.local DIRECT_URL cannot linger when the overlay only sets DATABASE_URL.
const prismaEnvOverlay = process.env.PRISMA_ENV_FILE?.trim();
if (prismaEnvOverlay) {
  const overlayPath = resolve(root, prismaEnvOverlay);
  if (!existsSync(overlayPath)) {
    throw new Error(
      `PRISMA_ENV_FILE is set to "${prismaEnvOverlay}" but that file does not exist. Run: npm run db:vercel:pull`,
    );
  }
  delete process.env.DIRECT_URL;
  delete process.env.DATABASE_URL;
  loadEnv({ path: overlayPath, override: true });
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
