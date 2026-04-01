import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { canStudentTakeAssessment, getAssessmentInOrg } from "@/lib/assessments/access";

const bodySchema = z.object({
  eventType: z.string().min(1).max(128),
  submissionId: z.string().optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional().nullable(),
});

/** Student (or linked flow) logs blur/fullscreen/visibility events during an attempt. */
export async function POST(req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await canStudentTakeAssessment(user.id, assessment))) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

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

  const payloadJson: Prisma.InputJsonValue | undefined =
    parsed.data.payload == null ? undefined : (parsed.data.payload as Prisma.InputJsonValue);

  const row = await prisma.proctoringEvent.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      assessmentId,
      submissionId: parsed.data.submissionId ?? null,
      eventType: parsed.data.eventType,
      payload: payloadJson,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, event: row });
}
