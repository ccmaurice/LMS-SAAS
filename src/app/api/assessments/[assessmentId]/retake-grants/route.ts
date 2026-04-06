import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";

const bodySchema = z.object({
  userId: z.string().min(1).max(128),
  staffNote: z.string().max(2000).optional().nullable(),
  fromSubmissionId: z.string().min(1).max(128).optional().nullable(),
});

/**
 * Staff/admin: grant one extra attempt (quiz or exam) by inserting an approved retake row.
 * Consumed when the learner is at max attempts and starts a new session.
 */
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

  const student = await prisma.user.findFirst({
    where: { id: parsed.data.userId, organizationId: user.organizationId },
    select: { id: true, role: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found in this organization" }, { status: 404 });
  }

  const enrolled = await prisma.enrollment.findFirst({
    where: { userId: student.id, courseId: assessment.courseId },
    select: { id: true },
  });
  if (!enrolled) {
    return NextResponse.json({ error: "That user is not enrolled in this course" }, { status: 400 });
  }

  let fromSubmissionId: string | null = null;
  if (parsed.data.fromSubmissionId) {
    const sub = await prisma.submission.findFirst({
      where: {
        id: parsed.data.fromSubmissionId,
        assessmentId,
        userId: student.id,
      },
      select: { id: true },
    });
    if (!sub) {
      return NextResponse.json({ error: "Submission not found for this student" }, { status: 400 });
    }
    fromSubmissionId = sub.id;
  }

  const note = parsed.data.staffNote?.trim() || null;
  const now = new Date();

  const grant = await prisma.assessmentRetakeRequest.create({
    data: {
      assessmentId,
      userId: student.id,
      fromSubmissionId,
      status: "APPROVED",
      reviewedById: user.id,
      reviewedAt: now,
      staffNote: note,
      studentNote: null,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ grant });
}
