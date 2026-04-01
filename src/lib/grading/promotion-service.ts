import type { PromotionStanding } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { computeCourseSemesterGradePercent } from "@/lib/grading/course-grade";

export type SemesterAvgs = {
  s1: number | null;
  s2: number | null;
  s3: number | null;
  cumulative: number | null;
};

function meanNullable(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function standingFromCumulative(
  cumulativePercent: number,
  passMin: number,
  probationMin: number,
): PromotionStanding {
  if (cumulativePercent >= passMin) return "PASS";
  if (cumulativePercent >= probationMin) return "PROBATION";
  return "RETAIN";
}

/** Per-semester mean of course semester grades + cumulative mean across semesters that have data. */
export async function computeStudentSemesterRollup(args: {
  userId: string;
  organizationId: string;
}): Promise<SemesterAvgs> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: args.userId, course: { organizationId: args.organizationId } },
    include: {
      course: {
        select: {
          id: true,
          organizationId: true,
          gradingScale: true,
          gradeWeightContinuous: true,
          gradeWeightExam: true,
        },
      },
    },
  });

  const courseSemesterGrades: { sem: 1 | 2 | 3; pct: number }[] = [];

  for (const e of enrollments) {
    for (const sem of [1, 2, 3] as const) {
      const pct = await computeCourseSemesterGradePercent({
        userId: args.userId,
        courseId: e.course.id,
        semester: sem,
        weightContinuous: e.course.gradeWeightContinuous,
        weightExam: e.course.gradeWeightExam,
        organizationId: e.course.organizationId,
        gradingScale: e.course.gradingScale,
      });
      if (pct != null) {
        courseSemesterGrades.push({ sem, pct });
      }
    }
  }

  const avgForSem = (s: 1 | 2 | 3) => {
    const pts = courseSemesterGrades.filter((g) => g.sem === s).map((g) => g.pct);
    if (pts.length === 0) return null;
    return pts.reduce((a, b) => a + b, 0) / pts.length;
  };

  const s1 = avgForSem(1);
  const s2 = avgForSem(2);
  const s3 = avgForSem(3);
  const cumulative = meanNullable([s1, s2, s3]);

  return { s1, s2, s3, cumulative };
}

export async function recomputeAndStorePromotionSnapshots(organizationId: string): Promise<number> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      academicYearLabel: true,
      promotionPassMinPercent: true,
      promotionProbationMinPercent: true,
    },
  });
  if (!org) return 0;

  const students = await prisma.user.findMany({
    where: { organizationId, role: "STUDENT", suspendedAt: null },
    select: { id: true },
  });

  let count = 0;
  for (const s of students) {
    const rollup = await computeStudentSemesterRollup({ userId: s.id, organizationId });
    const standing: PromotionStanding =
      rollup.cumulative == null
        ? "RETAIN"
        : standingFromCumulative(
            rollup.cumulative,
            org.promotionPassMinPercent,
            org.promotionProbationMinPercent,
          );

    await prisma.studentPromotionSnapshot.upsert({
      where: {
        organizationId_userId_academicYearLabel: {
          organizationId,
          userId: s.id,
          academicYearLabel: org.academicYearLabel,
        },
      },
      create: {
        organizationId,
        userId: s.id,
        academicYearLabel: org.academicYearLabel,
        semester1AvgPercent: rollup.s1,
        semester2AvgPercent: rollup.s2,
        semester3AvgPercent: rollup.s3,
        cumulativeAvgPercent: rollup.cumulative,
        standing,
      },
      update: {
        semester1AvgPercent: rollup.s1,
        semester2AvgPercent: rollup.s2,
        semester3AvgPercent: rollup.s3,
        cumulativeAvgPercent: rollup.cumulative,
        standing,
        computedAt: new Date(),
      },
    });
    count += 1;
  }

  return count;
}
