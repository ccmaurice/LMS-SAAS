import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function isPostgresUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.startsWith("postgresql://") || u.startsWith("postgres://");
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!isPostgresUrl(connectionString)) {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL connection string (postgresql:// or postgres://). For Supabase, use the pooler URL for the app and set DIRECT_URL for migrations.',
    );
  }

  const pool =
    process.env.NODE_ENV !== "production"
      ? (globalForPrisma.pgPool ??= new Pool({ connectionString }))
      : new Pool({
          connectionString,
          max: Number(process.env.PG_POOL_MAX || 15),
        });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
}

function dropStalePrismaSingleton() {
  if (process.env.NODE_ENV === "production") return;
  const c = globalForPrisma.prisma;
  if (!c) return;
  if ((c as unknown as { constructor: unknown }).constructor !== PrismaClient) {
    globalForPrisma.prisma = undefined;
    return;
  }
  const p = c as unknown as {
    organizationMessage?: { findMany?: unknown };
    directMessageThread?: { findMany?: unknown };
  };
  if (
    typeof p.organizationMessage?.findMany !== "function" ||
    typeof p.directMessageThread?.findMany !== "function"
  ) {
    globalForPrisma.prisma = undefined;
  }
}

dropStalePrismaSingleton();

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
