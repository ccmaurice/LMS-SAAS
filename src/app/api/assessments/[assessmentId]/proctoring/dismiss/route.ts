import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";

const bodySchema = z
  .object({
    submissionId: z.string().min(1).max(128).optional(),
    eventIds: z.array(z.string().min(1).max(128)).min(1).max(200).optional(),
    dismissNote: z.string().max(2000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasSub = Boolean(data.submissionId);
    const hasEvents = Boolean(data.eventIds?.length);
    if (hasSub === hasEvents) {
      ctx.addIssue({
        code: "custom",
        message: "Provide exactly one of submissionId or eventIds",
      });
    }
  });

/** Excuse integrity signals (audit: rows updated, not deleted). */
export async function POST(req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canTeacherActOnAssessmentCourse(user, assessment.courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const note = parsed.data.dismissNote?.trim() || null;
  const now = new Date();

  if (parsed.data.submissionId) {
    const sub = await prisma.submission.findFirst({
      where: {
        id: parsed.data.submissionId,
        assessmentId,
        assessment: { course: { organizationId: user.organizationId } },
      },
      select: { id: true },
    });
    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const result = await prisma.proctoringEvent.updateMany({
      where: {
        assessmentId,
        submissionId: sub.id,
        dismissedAt: null,
      },
      data: {
        dismissedAt: now,
        dismissedById: user.id,
        dismissNote: note,
      },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  }

  const ids = [...new Set(parsed.data.eventIds!)];
  const rows = await prisma.proctoringEvent.findMany({
    where: {
      id: { in: ids },
      assessmentId,
      organizationId: user.organizationId,
      dismissedAt: null,
    },
    select: { id: true },
  });
  if (rows.length !== ids.length) {
    return NextResponse.json(
      { error: "One or more events were not found, already excused, or not in this assessment" },
      { status: 400 },
    );
  }

  const result = await prisma.proctoringEvent.updateMany({
    where: { id: { in: ids } },
    data: {
      dismissedAt: now,
      dismissedById: user.id,
      dismissNote: note,
    },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
