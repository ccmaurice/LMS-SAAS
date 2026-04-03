import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { publishedAssessmentOutcomeAttention } from "@/lib/assessments/assessment-outcome-health";

export type OrgPublishedAssessmentOutcomeRollup = {
  publishedAssessments: number;
  /** Published assessments that would show “Needs attention” on course outcomes (low mean or low reach). */
  outcomeAttentionAssessments: number;
};

/** Aligns with /platform/usage revalidate — heavy SQL; safe to serve slightly stale for ops dashboards. */
const ROLLUP_REVALIDATE_SEC = 180;

function toInt(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type RawRollupRow = {
  organizationId: string;
  meanPct: unknown;
  scoredAttempts: unknown;
  distinctSubmitters: unknown;
  enrolled: unknown;
};

function rollupMapToRecord(m: Map<string, OrgPublishedAssessmentOutcomeRollup>): Record<string, OrgPublishedAssessmentOutcomeRollup> {
  return Object.fromEntries(m);
}

function recordToRollupMap(rec: Record<string, OrgPublishedAssessmentOutcomeRollup>): Map<string, OrgPublishedAssessmentOutcomeRollup> {
  return new Map(Object.entries(rec));
}

async function computeOutcomeRollupMap(organizationId?: string): Promise<Map<string, OrgPublishedAssessmentOutcomeRollup>> {
  const raw = organizationId
    ? await prisma.$queryRaw<RawRollupRow[]>`
        SELECT
          c."organizationId" AS "organizationId",
          (
            SELECT AVG(
              (COALESCE(s."totalScore", 0)::double precision / NULLIF(s."maxScore", 0)::double precision) * 100.0
            )
            FROM "Submission" s
            WHERE s."assessmentId" = a."id"
              AND s."status" = 'SUBMITTED'
              AND s."maxScore" IS NOT NULL
              AND s."maxScore" > 0
          ) AS "meanPct",
          (
            SELECT COUNT(*)::int
            FROM "Submission" s
            WHERE s."assessmentId" = a."id"
              AND s."status" = 'SUBMITTED'
              AND s."maxScore" IS NOT NULL
              AND s."maxScore" > 0
          ) AS "scoredAttempts",
          (
            SELECT COUNT(DISTINCT s."userId")::int
            FROM "Submission" s
            WHERE s."assessmentId" = a."id"
              AND s."status" = 'SUBMITTED'
          ) AS "distinctSubmitters",
          (
            SELECT COUNT(*)::int
            FROM "Enrollment" e
            WHERE e."courseId" = c."id"
          ) AS "enrolled"
        FROM "Assessment" a
        INNER JOIN "Course" c ON c."id" = a."courseId"
        WHERE a."published" = true
          AND c."organizationId" = ${organizationId}
      `
    : await prisma.$queryRaw<RawRollupRow[]>`
        SELECT
          c."organizationId" AS "organizationId",
          (
            SELECT AVG(
              (COALESCE(s."totalScore", 0)::double precision / NULLIF(s."maxScore", 0)::double precision) * 100.0
            )
            FROM "Submission" s
            WHERE s."assessmentId" = a."id"
              AND s."status" = 'SUBMITTED'
              AND s."maxScore" IS NOT NULL
              AND s."maxScore" > 0
          ) AS "meanPct",
          (
            SELECT COUNT(*)::int
            FROM "Submission" s
            WHERE s."assessmentId" = a."id"
              AND s."status" = 'SUBMITTED'
              AND s."maxScore" IS NOT NULL
              AND s."maxScore" > 0
          ) AS "scoredAttempts",
          (
            SELECT COUNT(DISTINCT s."userId")::int
            FROM "Submission" s
            WHERE s."assessmentId" = a."id"
              AND s."status" = 'SUBMITTED'
          ) AS "distinctSubmitters",
          (
            SELECT COUNT(*)::int
            FROM "Enrollment" e
            WHERE e."courseId" = c."id"
          ) AS "enrolled"
        FROM "Assessment" a
        INNER JOIN "Course" c ON c."id" = a."courseId"
        WHERE a."published" = true
      `;

  const map = new Map<string, OrgPublishedAssessmentOutcomeRollup>();
  for (const row of raw) {
    const orgId = String(row.organizationId);
    const cur = map.get(orgId) ?? { publishedAssessments: 0, outcomeAttentionAssessments: 0 };
    cur.publishedAssessments += 1;

    const rawMean = row.meanPct == null ? null : Number(row.meanPct);
    const meanPercent = rawMean != null && Number.isFinite(rawMean) ? rawMean : null;
    const scoredAttemptCount = toInt(row.scoredAttempts);
    const distinctSubmitters = toInt(row.distinctSubmitters);
    const enrolledCount = toInt(row.enrolled);

    if (
      publishedAssessmentOutcomeAttention({
        meanPercent,
        scoredAttemptCount,
        distinctSubmitters,
        enrolledCount,
      })
    ) {
      cur.outcomeAttentionAssessments += 1;
    }
    map.set(orgId, cur);
  }
  return map;
}

/**
 * Per-organization counts over published assessments only. Uses the same thresholds as course staff outcomes
 * (assessment-outcome-health), with mean % = AVG of per-submission score% among scored rows (positive max).
 * Fleet-wide results are cached briefly to protect the DB when /platform and /platform/usage load together.
 */
export async function getOutcomeAttentionRollupByOrganization(
  organizationId?: string,
): Promise<Map<string, OrgPublishedAssessmentOutcomeRollup>> {
  if (organizationId) {
    const rec = await unstable_cache(
      async () => rollupMapToRecord(await computeOutcomeRollupMap(organizationId)),
      ["platform-outcome-rollup", "org", organizationId],
      { revalidate: ROLLUP_REVALIDATE_SEC },
    )();
    return recordToRollupMap(rec);
  }
  const rec = await unstable_cache(
    async () => rollupMapToRecord(await computeOutcomeRollupMap(undefined)),
    ["platform-outcome-rollup", "fleet"],
    { revalidate: ROLLUP_REVALIDATE_SEC },
  )();
  return recordToRollupMap(rec);
}

export async function getSingleOrgOutcomeRollup(
  organizationId: string,
): Promise<OrgPublishedAssessmentOutcomeRollup> {
  const m = await getOutcomeAttentionRollupByOrganization(organizationId);
  return m.get(organizationId) ?? { publishedAssessments: 0, outcomeAttentionAssessments: 0 };
}
