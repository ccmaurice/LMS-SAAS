import { submitParticipationPercent } from "@/lib/assessments/course-assessment-outcomes";

/**
 * Phase G — lightweight staff signals on course assessment outcome rollups (not prescriptive).
 * Phase H — course overview banner and outcomes “Needs attention” filter use the same thresholds via
 * assessmentOutcomeNeedsAttention.
 * Platform tenant usage merges SQL rollups via publishedAssessmentOutcomeAttention.
 */

export type AssessmentOutcomeHealth = {
  /** Published assessment with enough scored attempts and mean total % below threshold. */
  lowMean: boolean;
  /** Published, enough enrollments, but few distinct students submitted. */
  lowReach: boolean;
};

const LOW_MEAN_PCT = 42.5;
const MIN_SCORED_ATTEMPTS_FOR_LOW_MEAN = 5;
const MIN_ENROLLED_FOR_REACH = 8;
const LOW_REACH_PARTICIP_PCT = 28;

export function assessmentOutcomeHealth(args: {
  published: boolean;
  mean: number | null;
  scoredAttemptCount: number;
  participationPercent: number | null;
  enrolledCount: number;
}): AssessmentOutcomeHealth {
  const lowMean =
    args.published &&
    args.mean != null &&
    args.mean < LOW_MEAN_PCT &&
    args.scoredAttemptCount >= MIN_SCORED_ATTEMPTS_FOR_LOW_MEAN;

  const lowReach =
    args.published &&
    args.participationPercent != null &&
    args.enrolledCount >= MIN_ENROLLED_FOR_REACH &&
    args.participationPercent < LOW_REACH_PARTICIP_PCT;

  return { lowMean, lowReach };
}

/** True when assessmentOutcomeHealth would set either staff flag. */
export function assessmentOutcomeNeedsAttention(
  args: Parameters<typeof assessmentOutcomeHealth>[0],
): boolean {
  const h = assessmentOutcomeHealth(args);
  return h.lowMean || h.lowReach;
}

/** Same flags as the course outcomes table, for a published assessment rollup (e.g. SQL AVG + counts). */
export function publishedAssessmentOutcomeAttention(args: {
  meanPercent: number | null;
  scoredAttemptCount: number;
  distinctSubmitters: number;
  enrolledCount: number;
}): boolean {
  const particip = submitParticipationPercent(args.distinctSubmitters, args.enrolledCount);
  return assessmentOutcomeNeedsAttention({
    published: true,
    mean: args.meanPercent,
    scoredAttemptCount: args.scoredAttemptCount,
    participationPercent: particip,
    enrolledCount: args.enrolledCount,
  });
}
