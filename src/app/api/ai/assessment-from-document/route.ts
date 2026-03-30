import { NextResponse } from "next/server";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { generateAssessmentQuestionsFromExcerpt } from "@/lib/ai/gemini-assessment";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart form with file" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  let text = "";
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const mod = await import("pdf-parse");
    const pdfParse = (mod as { default?: (b: Buffer) => Promise<{ text?: string }> }).default ?? (mod as unknown as (b: Buffer) => Promise<{ text?: string }>);
    const parsed = await pdfParse(buf);
    text = typeof parsed.text === "string" ? parsed.text : "";
  } catch {
    return NextResponse.json({ error: "Could not read PDF (install pdf-parse or try a smaller file)" }, { status: 400 });
  }

  if (text.trim().length < 30) {
    return NextResponse.json({ error: "Extracted text too short — PDF may be image-only" }, { status: 400 });
  }

  const questions = await generateAssessmentQuestionsFromExcerpt(text);
  return NextResponse.json({ questions });
}
