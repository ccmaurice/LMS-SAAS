import type { AssessmentKind } from "@/generated/prisma/enums";

export type SubmissionPercentInput = { kind: AssessmentKind; percent: number };

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Pure CA / exam weighting: QUIZ → continuous, EXAM → exam.
 * Missing category collapses weight to the other (same as `course-grade.ts`).
 */
export function computeWeightedSemesterPercent(args: {
  submissionPercents: SubmissionPercentInput[];
  weightContinuous: number;
  weightExam: number;
}): {
  percent: number | null;
  continuousPercent: number | null;
  examPercent: number | null;
  weightsUsed: { continuous: number; exam: number };
} {
  let wCa = args.weightContinuous;
  let wEx = args.weightExam;
  const sum = wCa + wEx;
  if (sum > 0 && Math.abs(sum - 1) > 0.001) {
    wCa /= sum;
    wEx /= sum;
  }

  const caPts = args.submissionPercents.filter((s) => s.kind === "QUIZ").map((s) => s.percent);
  const exPts = args.submissionPercents.filter((s) => s.kind === "EXAM").map((s) => s.percent);
  const sCa = mean(caPts);
  const sEx = mean(exPts);

  if (sCa == null && sEx == null) {
    return { percent: null, continuousPercent: null, examPercent: null, weightsUsed: { continuous: wCa, exam: wEx } };
  }
  if (sCa == null) {
    return { percent: sEx, continuousPercent: null, examPercent: sEx, weightsUsed: { continuous: 0, exam: 1 } };
  }
  if (sEx == null) {
    return { percent: sCa, continuousPercent: sCa, examPercent: null, weightsUsed: { continuous: 1, exam: 0 } };
  }

  let wc = wCa;
  let we = wEx;
  if (caPts.length === 0 && exPts.length > 0) {
    wc = 0;
    we = 1;
  } else if (exPts.length === 0 && caPts.length > 0) {
    wc = 1;
    we = 0;
  }

  return {
    percent: wc * sCa + we * sEx,
    continuousPercent: sCa,
    examPercent: sEx,
    weightsUsed: { continuous: wc, exam: we },
  };
}
