import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import {
  canStudentTakeAssessment,
  getAssessmentInOrg,
} from "@/lib/assessments/access";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";
import { countCompletedAttempts } from "@/lib/assessments/retake";

function clampAttempts(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(50, Math.max(1, Math.floor(n)));
}

const postBodySchema = z.object({
  fromSubmissionId: z.string().min(1).optional(),
  studentNote: z.string().max(5000).optional(),
});

/** Student: create retake request. Staff: list pending + recent. */
export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canTeacherManageCourse(user, assessment.course.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.assessmentRetakeRequest.findMany({
    where: { assessmentId },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      user: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ requests: rows });
}

export async function POST(req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, course: { organizationId: user.organizationId } },
    select: {
      id: true,
      courseId: true,
      published: true,
      maxAttemptsPerStudent: true,
      retakeRequiresApproval: true,
      course: {
        select: {
          id: true,
          createdById: true,
          organizationId: true,
          organization: { select: { educationLevel: true } },
        },
      },
      assessmentCohorts: { select: { cohortId: true } },
      assessmentDepartments: { select: { departmentId: true } },
    },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isStaffRole(user.role) && !(await canStudentTakeAssessment(user.id, assessment))) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  if (isStaffRole(user.role)) {
    return NextResponse.json({ error: "Students only" }, { status: 403 });
  }

  if (!assessment.retakeRequiresApproval) {
    return NextResponse.json(
      { error: "This assessment does not use retake approvals — use another attempt if allowed." },
      { status: 400 },
    );
  }

  const maxAttempts = clampAttempts(assessment.maxAttemptsPerStudent);
  const completed = await countCompletedAttempts(assessmentId, user.id);
  if (completed < maxAttempts) {
    return NextResponse.json(
      { error: "You still have attempts available — open the assessment to start again." },
      { status: 400 },
    );
  }

  const pending = await prisma.assessmentRetakeRequest.findFirst({
    where: { assessmentId, userId: user.id, status: "PENDING" },
  });
  if (pending) {
    return NextResponse.json({ error: "You already have a pending retake request." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  let fromSubmissionId: string | null = null;
  if (parsed.data.fromSubmissionId) {
    const sub = await prisma.submission.findFirst({
      where: {
        id: parsed.data.fromSubmissionId,
        assessmentId,
        userId: user.id,
        status: { in: ["SUBMITTED", "GRADED"] },
      },
      select: { id: true },
    });
    if (!sub) {
      return NextResponse.json({ error: "Invalid submission reference" }, { status: 400 });
    }
    fromSubmissionId = sub.id;
  }

  const created = await prisma.assessmentRetakeRequest.create({
    data: {
      assessmentId,
      userId: user.id,
      fromSubmissionId,
      studentNote: parsed.data.studentNote?.trim() || null,
    },
  });

  return NextResponse.json({ request: created });
}
