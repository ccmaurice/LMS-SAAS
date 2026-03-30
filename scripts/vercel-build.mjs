import { execSync } from "node:child_process";

const vercelEnv = process.env.VERCEL_ENV;

if (vercelEnv === "production") {
  const migrateDbUrl =
    process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!migrateDbUrl) {
    console.error(
      "[vercel-build] No database URL for migrations: set DIRECT_URL (Supabase direct/session, port 5432) and/or DATABASE_URL for Production builds.",
    );
    process.exit(1);
  }
  console.log("[vercel-build] prisma migrate deploy (VERCEL_ENV=production)");
  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
  } catch {
    console.error(
      "\n[vercel-build] prisma migrate deploy failed (exit non-zero). Scroll up in this log for the Prisma message. Typical causes: wrong DATABASE_URL, DB firewall blocking Vercel, SSL params, or migration/SQL errors against an existing DB.",
    );
    process.exit(1);
  }
} else {
  console.log(
    `[vercel-build] skipping migrate (VERCEL_ENV=${vercelEnv ?? "unset"}); run migrations against preview DB manually if needed`,
  );
}

console.log("[vercel-build] next build");
try {
  execSync("npx next build", { stdio: "inherit", env: process.env });
} catch {
  console.error("\n[vercel-build] next build failed. Scroll up for Next.js / TypeScript errors.");
  process.exit(1);
}
