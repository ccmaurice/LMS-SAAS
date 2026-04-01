import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requireRoles } from "@/lib/api/guard";

const bodySchema = z.object({
  csvText: z.string().min(1).max(2_000_000),
});

/**
 * Validates a header row for bulk user import. Full async job ingestion can extend this route.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const firstLine = parsed.data.csvText.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const headers = firstLine.split(",").map((h) => h.trim().toLowerCase());
  const required = ["email", "role"];
  const missing = required.filter((k) => !headers.includes(k));
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Missing required columns: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const rowCount = parsed.data.csvText.split(/\r?\n/).filter((l) => l.trim().length > 0).length - 1;
  return NextResponse.json({
    ok: true,
    rowsValidated: Math.max(0, rowCount),
    message: "CSV structure OK. Row creation is not executed in this MVP — wire a job queue to insert users.",
  });
}
