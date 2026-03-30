import { NextResponse } from "next/server";
import { requirePlatformOperator } from "@/lib/platform/api-guard";
import { platformDatabaseToolsEnabled, runMysqldumpPlain } from "@/lib/platform/mysql-cli";

export const maxDuration = 300;

export async function GET() {
  const gate = await requirePlatformOperator();
  if (!gate.op) return gate.response!;

  if (!platformDatabaseToolsEnabled()) {
    return NextResponse.json(
      {
        error:
          "Database backup tools are disabled. They only apply to mysql:// URLs with ENABLE_PLATFORM_DATABASE_TOOLS=true and mysqldump on PATH. For Supabase/Postgres, use Dashboard → Backups or pg_dump.",
      },
      { status: 403 },
    );
  }

  const result = await runMysqldumpPlain();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `saas-lms-full-backup-${stamp}.sql`;

  return new NextResponse(result.sql, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
