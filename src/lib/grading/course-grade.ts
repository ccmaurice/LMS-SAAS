import type { AssessmentKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

function submissionPercent(total: number | null, max: number | null): number | null {
  if (total == null || max == null || max <= 0) return null;
  return (total / max) * 100;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Weighted semester grade for one course: G = w_ca * S_ca + w_exam * S_exam (percent 0–100).
 * QUIZ → continuous assessment; EXAM → exam. Missing category: weight collapses to the other.
 */
export async function computeCourseSemesterGradePercent(args: {
  userId: string;
  courseId: string;
  semester: 1 | 2 | 3;
  weightContinuous: number;
  weightExam: number;
}): Promise<number | null> {
  const { userId, courseId, semester, weightContinuous: wCaRaw, weightExam: wExRaw } = args;
  let wCa = wCaRaw;
  let wEx = wExRaw;
  const sum = wCa + wEx;
  if (sum > 0 && Math.abs(sum - 1) > 0.001) {
    wCa /= sum;
    wEx /= sum;
  }

  const submissions = await prisma.submission.findMany({
    where: {
      userId,
      submittedAt: { not: null },
      status: { in: ["SUBMITTED", "GRADED"] },
      assessment: {
        courseId,
        semester,
      },
    },
    include: {
      assessment: { select: { kind: true } },
    },
  });

  const byKind = (k: AssessmentKind) =>
    submissions
      .filter((s) => s.assessment.kind === k)
      .map((s) => submissionPercent(s.totalScore, s.maxScore))
      .filter((x): x is number => x != null);

  const caPts = byKind("QUIZ");
  const exPts = byKind("EXAM");
  const sCa = mean(caPts);
  const sEx = mean(exPts);

  if (sCa == null && sEx == null) return null;
  if (sCa == null) return sEx;
  if (sEx == null) return sCa;

  let wc = wCa;
  let we = wEx;
  if (caPts.length === 0 && exPts.length > 0) {
    wc = 0;
    we = 1;
  } else if (exPts.length === 0 && caPts.length > 0) {
    wc = 1;
    we = 0;
  }

  return wc * sCa + we * sEx;
}
