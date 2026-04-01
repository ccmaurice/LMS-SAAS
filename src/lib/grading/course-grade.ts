import type { AssessmentKind, EducationLevel, GradingScaleType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getEducationContext } from "@/lib/education_context";
import type { OrganizationSettings } from "@/lib/education_context/schema";
import { computeWeightedSemesterPercent, letterAndGpaForLevel } from "@/lib/grading_engine";

function submissionPercent(total: number | null, max: number | null): number | null {
  if (total == null || max == null || max <= 0) return null;
  return (total / max) * 100;
}

export type CourseSemesterGradeResult = {
  percent: number;
  letter?: string;
  gpa?: number;
  components: {
    continuousPercent: number | null;
    examPercent: number | null;
    weightsUsed: { continuous: number; exam: number };
  };
  educationLevel: EducationLevel;
  gradingScale: GradingScaleType;
};

/**
 * Structured semester grade for one course (percent + optional letter/GPA from org config).
 */
export async function computeCourseSemesterGrade(args: {
  userId: string;
  courseId: string;
  semester: 1 | 2 | 3;
  weightContinuous: number;
  weightExam: number;
  organizationId: string;
  gradingScale: GradingScaleType;
}): Promise<CourseSemesterGradeResult | null> {
  const ctx = await getEducationContext(args.organizationId);
  const educationLevel = ctx?.educationLevel ?? "SECONDARY";
  const orgSettings: OrganizationSettings = ctx?.settings ?? {};

  const submissions = await prisma.submission.findMany({
    where: {
      userId: args.userId,
      submittedAt: { not: null },
      status: { in: ["SUBMITTED", "GRADED"] },
      assessment: {
        courseId: args.courseId,
        semester: args.semester,
      },
    },
    include: {
      assessment: { select: { kind: true } },
    },
  });

  const submissionPercents = submissions
    .map((s) => {
      const pct = submissionPercent(s.totalScore, s.maxScore);
      if (pct == null) return null;
      return { kind: s.assessment.kind as AssessmentKind, percent: pct };
    })
    .filter((x): x is { kind: AssessmentKind; percent: number } => x != null);

  const weighted = computeWeightedSemesterPercent({
    submissionPercents,
    weightContinuous: args.weightContinuous,
    weightExam: args.weightExam,
  });

  if (weighted.percent == null) return null;

  const { letter, gpa } = letterAndGpaForLevel(
    weighted.percent,
    educationLevel,
    args.gradingScale,
    orgSettings,
  );

  return {
    percent: weighted.percent,
    letter,
    gpa,
    components: {
      continuousPercent: weighted.continuousPercent,
      examPercent: weighted.examPercent,
      weightsUsed: weighted.weightsUsed,
    },
    educationLevel,
    gradingScale: args.gradingScale,
  };
}

/** Weighted semester percent only (backward compatible with promotion engine). */
export async function computeCourseSemesterGradePercent(args: {
  userId: string;
  courseId: string;
  semester: 1 | 2 | 3;
  weightContinuous: number;
  weightExam: number;
  organizationId?: string;
  gradingScale?: GradingScaleType;
}): Promise<number | null> {
  let organizationId = args.organizationId;
  let gradingScale = args.gradingScale;
  if (organizationId == null || gradingScale == null) {
    const course = await prisma.course.findUnique({
      where: { id: args.courseId },
      select: { organizationId: true, gradingScale: true },
    });
    if (!course) return null;
    organizationId = course.organizationId;
    gradingScale = course.gradingScale;
  }

  const full = await computeCourseSemesterGrade({
    userId: args.userId,
    courseId: args.courseId,
    semester: args.semester,
    weightContinuous: args.weightContinuous,
    weightExam: args.weightExam,
    organizationId,
    gradingScale,
  });
  return full?.percent ?? null;
}
