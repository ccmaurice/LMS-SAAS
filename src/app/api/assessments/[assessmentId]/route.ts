import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import {
  canManageAssessments,
  canStudentViewAssessment,
  getAssessmentInOrg,
} from "@/lib/assessments/access";
import { userInstructsCohort } from "@/lib/school/cohort-access";
import { userFacultyOfDepartment } from "@/lib/school/department-access";
import { questionToStudentJson } from "@/lib/assessments/sanitize";
import { isStaffRole } from "@/lib/courses/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
import { resolveQuestionsForStudentTake } from "@/lib/assessment_engine";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(20_000).optional().nullable(),
  kind: z.enum(["QUIZ", "EXAM"]).optional(),
  semester: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]).optional(),
  timeLimitMinutes: z.number().int().min(1).max(600).optional().nullable(),
  published: z.boolean().optional(),
  /** When true, students cannot start a new attempt (draft in progress may still submit). */
  studentAttemptsLocked: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showAnswersToStudents: z.boolean().optional(),
  maxAttemptsPerStudent: z.number().int().min(1).max(50).optional(),
  retakeRequiresApproval: z.boolean().optional(),
  deliveryMode: z.enum(["FORMATIVE", "SECURE_ONLINE", "LOCKDOWN"]).optional(),
  /** Dashboard calendar: optional open / due instants (ISO). */
  availableFrom: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  /** K–12: empty = all enrolled. Each id must be linked to the course; teachers must teach that class. */
  cohortIds: z.array(z.string().min(1)).optional(),
  /** Higher ed: empty = all enrolled. Each id must be linked to the course; teachers must be department faculty/chair. */
  departmentIds: z.array(z.string().min(1)).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, course: { organizationId: user.organizationId } },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          organizationId: true,
          createdById: true,
          organization: { select: { educationLevel: true } },
        },
      },
      assessmentCohorts: { select: { cohortId: true } },
      assessmentDepartments: { select: { departmentId: true } },
      questions: { orderBy: { order: "asc" } },
      questionPools: {
        orderBy: { sortOrder: "asc" },
        include: { entries: { include: { question: true } } },
      },
    },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const staffUser = isStaffRole(user.role);
  let privilegedStaff = false;
  if (staffUser) {
    if (user.role === "ADMIN") {
      privilegedStaff = true;
    } else if (user.role === "TEACHER") {
      privilegedStaff = await canTeacherActOnAssessmentCourse(user, assessment.courseId);
    }
  }
  const studentAllowed = await canStudentViewAssessment(user.id, user.role, assessment);

  if (!privilegedStaff && !studentAllowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const staffView = privilegedStaff;
  let sourceQuestions = assessment.questions;
  if (!staffView && assessment.questionPools.some((p) => p.entries.length > 0)) {
    sourceQuestions = resolveQuestionsForStudentTake({
      directQuestions: assessment.questions,
      pools: assessment.questionPools.map((p) => ({
        id: p.id,
        drawCount: p.drawCount,
        sortOrder: p.sortOrder,
        entries: p.entries.map((e) => ({ questionId: e.questionId, question: e.question })),
      })),
    });
  }

  let questionsOut = staffView
    ? assessment.questions
    : sourceQuestions.map((q) => questionToStudentJson(q, { shuffleOptions: assessment.shuffleOptions }));

  if (!staffView && assessment.shuffleQuestions) {
    questionsOut = [...questionsOut].sort(() => Math.random() - 0.5);
  }

  const level = assessment.course.organization.educationLevel;

  return NextResponse.json({
    assessment: {
      id: assessment.id,
      courseId: assessment.courseId,
      title: assessment.title,
      description: assessment.description,
      kind: assessment.kind,
      semester: assessment.semester,
      timeLimitMinutes: assessment.timeLimitMinutes,
      published: assessment.published,
      studentAttemptsLocked: assessment.studentAttemptsLocked,
      shuffleQuestions: assessment.shuffleQuestions,
      shuffleOptions: assessment.shuffleOptions,
      showAnswersToStudents: assessment.showAnswersToStudents,
      maxAttemptsPerStudent: assessment.maxAttemptsPerStudent,
      retakeRequiresApproval: assessment.retakeRequiresApproval,
      deliveryMode: assessment.deliveryMode,
      course: assessment.course,
      cohortIds: staffView && level !== "HIGHER_ED" ? assessment.assessmentCohorts.map((r) => r.cohortId) : undefined,
      departmentIds:
        staffView && level === "HIGHER_ED" ? assessment.assessmentDepartments.map((r) => r.departmentId) : undefined,
    },
    questions: questionsOut,
    staffView,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const existing = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canManageAssessments(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await canTeacherActOnAssessmentCourse(user, existing.courseId))) {
    return NextResponse.json({ error: "You do not have permission to change this assessment" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const eduLevel = existing.course.organization.educationLevel;

  if (parsed.data.cohortIds !== undefined) {
    if (eduLevel === "HIGHER_ED") {
      return NextResponse.json(
        { error: "This school uses departments for assessment targeting, not classes." },
        { status: 400 },
      );
    }
    const course = await prisma.course.findFirst({
      where: { id: existing.courseId, organizationId: user.organizationId },
      select: { createdById: true, courseCohorts: { select: { cohortId: true } } },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const linked = new Set(course.courseCohorts.map((c) => c.cohortId));
    const unique = [...new Set(parsed.data.cohortIds)];
    for (const cid of unique) {
      if (!linked.has(cid)) {
        return NextResponse.json(
          { error: "Each class must be linked to this course on the course edit page before targeting assessments." },
          { status: 400 },
        );
      }
      if (user.role === "TEACHER" && !(await userInstructsCohort(user.id, cid))) {
        return NextResponse.json({ error: "You can only assign assessments to classes you teach." }, { status: 403 });
      }
    }
    await prisma.$transaction([
      prisma.assessmentCohort.deleteMany({ where: { assessmentId } }),
      ...(unique.length > 0
        ? [
            prisma.assessmentCohort.createMany({
              data: unique.map((cohortId) => ({ assessmentId, cohortId })),
            }),
          ]
        : []),
    ]);
  }

  if (parsed.data.departmentIds !== undefined) {
    if (eduLevel !== "HIGHER_ED") {
      return NextResponse.json(
        { error: "Department targeting applies to higher-education organizations only." },
        { status: 400 },
      );
    }
    const course = await prisma.course.findFirst({
      where: { id: existing.courseId, organizationId: user.organizationId },
      select: { courseDepartments: { select: { departmentId: true } } },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const linked = new Set(course.courseDepartments.map((d) => d.departmentId));
    const unique = [...new Set(parsed.data.departmentIds)];
    for (const did of unique) {
      if (!linked.has(did)) {
        return NextResponse.json(
          {
            error:
              "Each department must be linked to this course on the course edit page before targeting assessments.",
          },
          { status: 400 },
        );
      }
      if (user.role === "TEACHER" && !(await userFacultyOfDepartment(user.id, did))) {
        return NextResponse.json(
          { error: "You can only assign assessments to departments where you are faculty or chair." },
          { status: 403 },
        );
      }
    }
    await prisma.$transaction([
      prisma.assessmentDepartment.deleteMany({ where: { assessmentId } }),
      ...(unique.length > 0
        ? [
            prisma.assessmentDepartment.createMany({
              data: unique.map((departmentId) => ({ assessmentId, departmentId })),
            }),
          ]
        : []),
    ]);
  }

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description === null ? null : parsed.data.description.trim(),
      }),
      ...(parsed.data.kind !== undefined && { kind: parsed.data.kind }),
      ...(parsed.data.semester !== undefined && { semester: parsed.data.semester }),
      ...(parsed.data.timeLimitMinutes !== undefined && {
        timeLimitMinutes: parsed.data.timeLimitMinutes,
      }),
      ...(parsed.data.published !== undefined && { published: parsed.data.published }),
      ...(parsed.data.studentAttemptsLocked !== undefined && {
        studentAttemptsLocked: parsed.data.studentAttemptsLocked,
      }),
      ...(parsed.data.shuffleQuestions !== undefined && {
        shuffleQuestions: parsed.data.shuffleQuestions,
      }),
      ...(parsed.data.shuffleOptions !== undefined && {
        shuffleOptions: parsed.data.shuffleOptions,
      }),
      ...(parsed.data.showAnswersToStudents !== undefined && {
        showAnswersToStudents: parsed.data.showAnswersToStudents,
      }),
      ...(parsed.data.maxAttemptsPerStudent !== undefined && {
        maxAttemptsPerStudent: parsed.data.maxAttemptsPerStudent,
      }),
      ...(parsed.data.retakeRequiresApproval !== undefined && {
        retakeRequiresApproval: parsed.data.retakeRequiresApproval,
      }),
      ...(parsed.data.deliveryMode !== undefined && { deliveryMode: parsed.data.deliveryMode }),
      ...(parsed.data.availableFrom !== undefined && {
        availableFrom: parsed.data.availableFrom ? new Date(parsed.data.availableFrom) : null,
      }),
      ...(parsed.data.dueAt !== undefined && {
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      }),
    },
  });

  const cohortIds =
    parsed.data.cohortIds !== undefined
      ? (
          await prisma.assessmentCohort.findMany({
            where: { assessmentId },
            select: { cohortId: true },
          })
        ).map((r) => r.cohortId)
      : undefined;

  const departmentIds =
    parsed.data.departmentIds !== undefined
      ? (
          await prisma.assessmentDepartment.findMany({
            where: { assessmentId },
            select: { departmentId: true },
          })
        ).map((r) => r.departmentId)
      : undefined;

  return NextResponse.json({
    ok: true,
    ...(cohortIds !== undefined ? { cohortIds } : {}),
    ...(departmentIds !== undefined ? { departmentIds } : {}),
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const existing = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canTeacherActOnAssessmentCourse(user, existing.courseId))) {
    return NextResponse.json({ error: "You do not have permission to delete this assessment" }, { status: 403 });
  }

  await prisma.assessment.delete({ where: { id: assessmentId } });
  return NextResponse.json({ ok: true });
}
