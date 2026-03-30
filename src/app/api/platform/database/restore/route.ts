import { NextResponse } from "next/server";
import { requirePlatformOperator } from "@/lib/platform/api-guard";
import { platformDatabaseToolsEnabled, runMysqlRestore } from "@/lib/platform/mysql-cli";

export const maxDuration = 300;

const CONFIRM = "RESTORE_FULL_DATABASE";

export async function POST(req: Request) {
  const gate = await requirePlatformOperator();
  if (!gate.op) return gate.response!;

  if (!platformDatabaseToolsEnabled()) {
    return NextResponse.json(
      {
        error:
          "Database restore tools are disabled. They only apply to mysql:// URLs with ENABLE_PLATFORM_DATABASE_TOOLS=true and mysql on PATH. For Supabase/Postgres, use SQL editor or psql.",
      },
      { status: 403 },
    );
  }

  const headerOk = req.headers.get("x-platform-restore-confirm") === CONFIRM;
  if (!headerOk) {
    return NextResponse.json(
      { error: `Missing or invalid X-Platform-Restore-Confirm header (must be ${CONFIRM}).` },
      { status: 400 },
    );
  }

  let sql: string;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const confirmField = form.get("confirmation");
    if (confirmField !== CONFIRM) {
      return NextResponse.json({ error: `Form field confirmation must be ${CONFIRM}.` }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Multipart body must include a file field." }, { status: 400 });
    }
    sql = await file.text();
  } else {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Expected JSON { sql, confirmation } or multipart form." }, { status: 400 });
    }
    const rec = body as { sql?: unknown; confirmation?: unknown };
    if (rec.confirmation !== CONFIRM) {
      return NextResponse.json({ error: `JSON confirmation must be ${CONFIRM}.` }, { status: 400 });
    }
    if (typeof rec.sql !== "string" || rec.sql.length === 0) {
      return NextResponse.json({ error: "JSON body must include a non-empty sql string." }, { status: 400 });
    }
    sql = rec.sql;
  }

  if (sql.length > 250 * 1024 * 1024) {
    return NextResponse.json({ error: "SQL payload exceeds 250 MB. Run restore from the database host instead." }, { status: 413 });
  }

  const result = await runMysqlRestore(sql);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
