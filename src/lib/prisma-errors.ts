/**
 * PrismaClientKnownRequestError uses `code`.
 * PrismaClientInitializationError (and some driver paths) use `errorCode` instead.
 * Walk `cause` for wrapped errors.
 */
export function getPrismaErrorCode(e: unknown): string | undefined {
  let cur: unknown = e;
  for (let depth = 0; depth < 6 && cur != null; depth++) {
    if (typeof cur !== "object") break;
    const o = cur as Record<string, unknown>;
    for (const key of ["code", "errorCode"] as const) {
      const v = o[key];
      if (typeof v === "string" && /^P\d{4}$/.test(v)) return v;
    }
    cur = o.cause;
  }
  return undefined;
}

/** User-facing hint for auth routes when the DB layer fails. */
export function resolveAuthDatabaseError(e: unknown): { status: number; error: string } | null {
  const code = getPrismaErrorCode(e);
  if (code) {
    switch (code) {
      case "P1001":
      case "P1017":
        return {
          status: 503,
          error:
            "Cannot reach the database. Start Postgres and confirm DATABASE_URL in .env.local points at it, then try again.",
        };
      case "P1000":
        return {
          status: 503,
          error:
            "The database rejected the connection (wrong user, password, or pg_hba). Fix DATABASE_URL and restart the dev server.",
        };
      case "P1003":
        return {
          status: 503,
          error:
            "The database named in DATABASE_URL does not exist. Create it (e.g. CREATE DATABASE saaslms) or update the URL.",
        };
      case "P1012":
        return {
          status: 503,
          error: "Database schema error. Run `npx prisma migrate deploy` or `npm run db:bootstrap`, then try again.",
        };
      case "P2021":
      case "P2022":
        return {
          status: 503,
          error:
            "The database schema is out of date or incomplete. Run `npm run db:deploy` then `npm run db:seed`. If `db:deploy` fails (e.g. after `db push`), run `npm run db:reset` to wipe local data and reapply migrations + seed.",
        };
      default:
        break;
    }
  }

  if (e instanceof Error && /DATABASE_URL/i.test(e.message)) {
    return { status: 503, error: e.message };
  }

  return null;
}

/**
 * Errors where public/marketing UI can safely fall back instead of showing a 500.
 * - P1001: Can't reach database server
 * - P1017: Server has closed the connection
 * - P2021: Table does not exist (migrations not applied)
 */
export function isPrismaPublicFallbackError(e: unknown): boolean {
  const code = getPrismaErrorCode(e);
  return code === "P1001" || code === "P1017" || code === "P2021";
}
