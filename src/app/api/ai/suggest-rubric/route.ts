import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { suggestMarkingScheme } from "@/lib/ai";

const bodySchema = z.object({
  topic: z.string().min(1).max(500),
  questionPrompt: z.string().max(10_000).optional(),
});

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
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

  const text = await suggestMarkingScheme(parsed.data.topic, parsed.data.questionPrompt);
  return NextResponse.json({ text });
}
