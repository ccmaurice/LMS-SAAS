import { prisma } from "@/lib/db";
import { getOutcomeAttentionRollupByOrganization } from "@/lib/platform/tenant-assessment-outcome-signals";
import {
  MOMENTUM_WEIGHTS,
  PUBLIC_EXTRA_SECTIONS_WEIGHT_CAP,
  USAGE_WEIGHTS,
} from "@/lib/platform/tenant-usage-weights";
import { parseSchoolPublicExtraCards, SCHOOL_PUBLIC_EXTRA_CARDS_KEY } from "@/lib/school-public";

/**
 * Raw per-tenant row counts from PostgreSQL (correlated subqueries — one round trip).
 * These approximate relative storage and query load; they are not byte-accurate disk usage.
 */
export type TenantUsageCounts = {
  id: string;
  name: string;
  slug: string;
  status: string;
  educationLevel: string;
  createdAt: Date;
  users: number;
  students: number;
  teachers: number;
  parents: number;
  admins: number;
  courses: number;
  enrollments: number;
  modules: number;
  lessons: number;
  lessonFiles: number;
  assessments: number;
  questions: number;
  submissions: number;
  answers: number;
  courseChatMessages: number;
  learningResources: number;
  blogPosts: number;
  schoolCalendarEvents: number;
  assessmentScheduleEntries: number;
  /** CmsEntry rows whose keys start with `school.public.` (public one-pager + cards). */
  schoolPublicCmsRows: number;
  /** Parsed count of custom sections from `school.public.extraCards`; included in weighted index. */
  publicExtraSections: number;
  cmsEntries: number;
  orgMessages: number;
  dmThreads: number;
  dmMessages: number;
  notifications: number;
  invites: number;
  cohorts: number;
  cohortMemberships: number;
  proctoringEvents: number;
  lessonProgressRows: number;
  resourceProgressRows: number;
  gradingAuditLogs: number;
  submissionsLast7Days: number;
  submissionsLast30Days: number;
  submissionsLast90Days: number;
  usersJoinedLast7Days: number;
  usersJoinedLast30Days: number;
  usersJoinedLast90Days: number;
  enrollmentsLast7Days: number;
  enrollmentsLast30Days: number;
  enrollmentsLast90Days: number;
  /** Published assessments (excludes drafts). */
  publishedAssessments: number;
  /** Published assessments flagged by the same rules as school “Assessment outcomes → Needs attention”. */
  outcomeAttentionAssessments: number;
};

export type TenantUsageAnalytics = TenantUsageCounts & {
  /** Heuristic score for ranking tenants (tune weights for your billing model). */
  weightedUsageIndex: number;
  /** Rough row-count sum (unweighted) for transparency. */
  totalDataRows: number;
  /** Recent-activity-only scores (submissions + joins + enrolls in window). */
  momentumIndex7: number;
  momentumIndex30: number;
  momentumIndex90: number;
};

export function computeMomentumIndex(submissions: number, usersJoined: number, enrollments: number): number {
  const w = MOMENTUM_WEIGHTS;
  return (
    Math.round((submissions * w.submissions + usersJoined * w.usersJoined + enrollments * w.enrollments) * 10) / 10
  );
}

export function computeWeightedUsageIndex(r: TenantUsageCounts): number {
  let w = 0;
  (Object.keys(USAGE_WEIGHTS) as (keyof typeof USAGE_WEIGHTS)[]).forEach((k) => {
    w += (r[k] as number) * USAGE_WEIGHTS[k];
  });
  return Math.round(w * 10) / 10;
}

export function computeTotalDataRows(r: TenantUsageCounts): number {
  // Omit role breakdown fields — they sum to `users` and would double-count.
  const keys: (keyof TenantUsageCounts)[] = [
    "users",
    "courses",
    "enrollments",
    "modules",
    "lessons",
    "lessonFiles",
    "assessments",
    "questions",
    "submissions",
    "answers",
    "courseChatMessages",
    "learningResources",
    "blogPosts",
    "schoolCalendarEvents",
    "assessmentScheduleEntries",
    "cmsEntries",
    "orgMessages",
    "dmThreads",
    "dmMessages",
    "notifications",
    "invites",
    "cohorts",
    "cohortMemberships",
    "proctoringEvents",
    "lessonProgressRows",
    "resourceProgressRows",
    "gradingAuditLogs",
  ];
  return keys.reduce((s, k) => s + (r[k] as number), 0);
}

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return Number(v) || 0;
}

function normalizeRow(raw: Record<string, unknown>): TenantUsageCounts {
  const pick = (k: string) => toNumber(raw[k]);
  return {
    id: String(raw.id),
    name: String(raw.name),
    slug: String(raw.slug),
    status: String(raw.status),
    educationLevel: String(raw.educationLevel),
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(String(raw.createdAt)),
    users: pick("users"),
    students: pick("students"),
    teachers: pick("teachers"),
    parents: pick("parents"),
    admins: pick("admins"),
    courses: pick("courses"),
    enrollments: pick("enrollments"),
    modules: pick("modules"),
    lessons: pick("lessons"),
    lessonFiles: pick("lessonFiles"),
    assessments: pick("assessments"),
    questions: pick("questions"),
    submissions: pick("submissions"),
    answers: pick("answers"),
    courseChatMessages: pick("courseChatMessages"),
    learningResources: pick("learningResources"),
    blogPosts: pick("blogPosts"),
    schoolCalendarEvents: pick("schoolCalendarEvents"),
    assessmentScheduleEntries: pick("assessmentScheduleEntries"),
    schoolPublicCmsRows: pick("schoolPublicCmsRows"),
    publicExtraSections: pick("publicExtraSections"),
    cmsEntries: pick("cmsEntries"),
    orgMessages: pick("orgMessages"),
    dmThreads: pick("dmThreads"),
    dmMessages: pick("dmMessages"),
    notifications: pick("notifications"),
    invites: pick("invites"),
    cohorts: pick("cohorts"),
    cohortMemberships: pick("cohortMemberships"),
    proctoringEvents: pick("proctoringEvents"),
    lessonProgressRows: pick("lessonProgressRows"),
    resourceProgressRows: pick("resourceProgressRows"),
    gradingAuditLogs: pick("gradingAuditLogs"),
    submissionsLast7Days: pick("submissionsLast7Days"),
    submissionsLast30Days: pick("submissionsLast30Days"),
    submissionsLast90Days: pick("submissionsLast90Days"),
    usersJoinedLast7Days: pick("usersJoinedLast7Days"),
    usersJoinedLast30Days: pick("usersJoinedLast30Days"),
    usersJoinedLast90Days: pick("usersJoinedLast90Days"),
    enrollmentsLast7Days: pick("enrollmentsLast7Days"),
    enrollmentsLast30Days: pick("enrollmentsLast30Days"),
    enrollmentsLast90Days: pick("enrollmentsLast90Days"),
    publishedAssessments: 0,
    outcomeAttentionAssessments: 0,
  };
}

/**
 * Fetches usage analytics for every organization. PostgreSQL only.
 */
export async function getTenantUsageAnalytics(): Promise<TenantUsageAnalytics[]> {
  const [raw, outcomeByOrg] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT
      o."id",
      o."name",
      o."slug",
      o."status"::text AS "status",
      o."educationLevel"::text AS "educationLevel",
      o."createdAt" AS "createdAt",
      (SELECT COUNT(*)::int FROM "User" u WHERE u."organizationId" = o."id") AS "users",
      (SELECT COUNT(*)::int FROM "User" u WHERE u."organizationId" = o."id" AND u."role" = 'STUDENT') AS "students",
      (SELECT COUNT(*)::int FROM "User" u WHERE u."organizationId" = o."id" AND u."role" = 'TEACHER') AS "teachers",
      (SELECT COUNT(*)::int FROM "User" u WHERE u."organizationId" = o."id" AND u."role" = 'PARENT') AS "parents",
      (SELECT COUNT(*)::int FROM "User" u WHERE u."organizationId" = o."id" AND u."role" = 'ADMIN') AS "admins",
      (SELECT COUNT(*)::int FROM "Course" c WHERE c."organizationId" = o."id") AS "courses",
      (SELECT COUNT(*)::int FROM "Enrollment" e INNER JOIN "Course" c ON c."id" = e."courseId" WHERE c."organizationId" = o."id") AS "enrollments",
      (SELECT COUNT(*)::int FROM "Module" m INNER JOIN "Course" c ON c."id" = m."courseId" WHERE c."organizationId" = o."id") AS "modules",
      (SELECT COUNT(*)::int FROM "Lesson" l
        INNER JOIN "Module" m ON m."id" = l."moduleId"
        INNER JOIN "Course" c ON c."id" = m."courseId"
        WHERE c."organizationId" = o."id") AS "lessons",
      (SELECT COUNT(*)::int FROM "LessonFile" lf
        INNER JOIN "Lesson" l ON l."id" = lf."lessonId"
        INNER JOIN "Module" m ON m."id" = l."moduleId"
        INNER JOIN "Course" c ON c."id" = m."courseId"
        WHERE c."organizationId" = o."id") AS "lessonFiles",
      (SELECT COUNT(*)::int FROM "Assessment" a INNER JOIN "Course" c ON c."id" = a."courseId" WHERE c."organizationId" = o."id") AS "assessments",
      (SELECT COUNT(*)::int FROM "Question" q
        INNER JOIN "Assessment" a ON a."id" = q."assessmentId"
        INNER JOIN "Course" c ON c."id" = a."courseId"
        WHERE c."organizationId" = o."id") AS "questions",
      (SELECT COUNT(*)::int FROM "Submission" s
        INNER JOIN "Assessment" a ON a."id" = s."assessmentId"
        INNER JOIN "Course" c ON c."id" = a."courseId"
        WHERE c."organizationId" = o."id") AS "submissions",
      (SELECT COUNT(*)::int FROM "Answer" ans
        INNER JOIN "Submission" s ON s."id" = ans."submissionId"
        INNER JOIN "Assessment" a ON a."id" = s."assessmentId"
        INNER JOIN "Course" c ON c."id" = a."courseId"
        WHERE c."organizationId" = o."id") AS "answers",
      (SELECT COUNT(*)::int FROM "CourseChatMessage" ccm INNER JOIN "Course" c ON c."id" = ccm."courseId" WHERE c."organizationId" = o."id") AS "courseChatMessages",
      (SELECT COUNT(*)::int FROM "LearningResource" lr WHERE lr."organizationId" = o."id") AS "learningResources",
      (SELECT COUNT(*)::int FROM "BlogPost" bp WHERE bp."organizationId" = o."id") AS "blogPosts",
      (SELECT COUNT(*)::int FROM "SchoolCalendarEvent" sce WHERE sce."organizationId" = o."id") AS "schoolCalendarEvents",
      (SELECT COUNT(*)::int FROM "AssessmentScheduleEntry" ase
        INNER JOIN "Assessment" a ON a."id" = ase."assessmentId"
        INNER JOIN "Course" c ON c."id" = a."courseId"
        WHERE c."organizationId" = o."id") AS "assessmentScheduleEntries",
      (SELECT COUNT(*)::int FROM "CmsEntry" ce
        WHERE ce."organizationId" = o."id" AND ce."key" LIKE 'school.public.%') AS "schoolPublicCmsRows",
      (SELECT COUNT(*)::int FROM "CmsEntry" ce WHERE ce."organizationId" = o."id") AS "cmsEntries",
      (SELECT COUNT(*)::int FROM "OrganizationMessage" om WHERE om."organizationId" = o."id") AS "orgMessages",
      (SELECT COUNT(*)::int FROM "DirectMessageThread" dt WHERE dt."organizationId" = o."id") AS "dmThreads",
      (SELECT COUNT(*)::int FROM "DirectMessage" dm
        INNER JOIN "DirectMessageThread" dt ON dt."id" = dm."threadId"
        WHERE dt."organizationId" = o."id") AS "dmMessages",
      (SELECT COUNT(*)::int FROM "Notification" n INNER JOIN "User" u ON u."id" = n."userId" WHERE u."organizationId" = o."id") AS "notifications",
      (SELECT COUNT(*)::int FROM "UserInvite" ui WHERE ui."organizationId" = o."id") AS "invites",
      (SELECT COUNT(*)::int FROM "SchoolCohort" sc WHERE sc."organizationId" = o."id") AS "cohorts",
      (SELECT COUNT(*)::int FROM "CohortMembership" cm
        INNER JOIN "SchoolCohort" sc ON sc."id" = cm."cohortId"
        WHERE sc."organizationId" = o."id") AS "cohortMemberships",
      (SELECT COUNT(*)::int FROM "ProctoringEvent" pe WHERE pe."organizationId" = o."id") AS "proctoringEvents",
      (SELECT COUNT(*)::int FROM "LessonProgress" lp
        INNER JOIN "Lesson" l ON l."id" = lp."lessonId"
        INNER JOIN "Module" m ON m."id" = l."moduleId"
        INNER JOIN "Course" c ON c."id" = m."courseId"
        WHERE c."organizationId" = o."id") AS "lessonProgressRows",
      (SELECT COUNT(*)::int FROM "ResourceProgress" rp
        INNER JOIN "LearningResource" lr ON lr."id" = rp."resourceId"
        WHERE lr."organizationId" = o."id") AS "resourceProgressRows",
      (SELECT COUNT(*)::int FROM "GradingAuditLog" gal WHERE gal."organizationId" = o."id") AS "gradingAuditLogs",
      (SELECT COUNT(*)::int FROM "Submission" s
        INNER JOIN "Assessment" a ON a."id" = s."assessmentId"
        INNER JOIN "Course" c ON c."id" = a."courseId"
        WHERE c."organizationId" = o."id"
        AND s."submittedAt" IS NOT NULL
        AND s."submittedAt" >= NOW() - INTERVAL '7 days') AS "submissionsLast7Days",
      (SELECT COUNT(*)::int FROM "Submission" s
        INNER JOIN "Assessment" a ON a."id" = s."assessmentId"
        INNER JOIN "Course" c ON c."id" = a."courseId"
        WHERE c."organizationId" = o."id"
        AND s."submittedAt" IS NOT NULL
        AND s."submittedAt" >= NOW() - INTERVAL '30 days') AS "submissionsLast30Days",
      (SELECT COUNT(*)::int FROM "Submission" s
        INNER JOIN "Assessment" a ON a."id" = s."assessmentId"
        INNER JOIN "Course" c ON c."id" = a."courseId"
        WHERE c."organizationId" = o."id"
        AND s."submittedAt" IS NOT NULL
        AND s."submittedAt" >= NOW() - INTERVAL '90 days') AS "submissionsLast90Days",
      (SELECT COUNT(*)::int FROM "User" u
        WHERE u."organizationId" = o."id"
        AND u."createdAt" >= NOW() - INTERVAL '7 days') AS "usersJoinedLast7Days",
      (SELECT COUNT(*)::int FROM "User" u
        WHERE u."organizationId" = o."id"
        AND u."createdAt" >= NOW() - INTERVAL '30 days') AS "usersJoinedLast30Days",
      (SELECT COUNT(*)::int FROM "User" u
        WHERE u."organizationId" = o."id"
        AND u."createdAt" >= NOW() - INTERVAL '90 days') AS "usersJoinedLast90Days",
      (SELECT COUNT(*)::int FROM "Enrollment" e
        INNER JOIN "Course" c ON c."id" = e."courseId"
        WHERE c."organizationId" = o."id"
        AND e."enrolledAt" >= NOW() - INTERVAL '7 days') AS "enrollmentsLast7Days",
      (SELECT COUNT(*)::int FROM "Enrollment" e
        INNER JOIN "Course" c ON c."id" = e."courseId"
        WHERE c."organizationId" = o."id"
        AND e."enrolledAt" >= NOW() - INTERVAL '30 days') AS "enrollmentsLast30Days",
      (SELECT COUNT(*)::int FROM "Enrollment" e
        INNER JOIN "Course" c ON c."id" = e."courseId"
        WHERE c."organizationId" = o."id"
        AND e."enrolledAt" >= NOW() - INTERVAL '90 days') AS "enrollmentsLast90Days"
    FROM "Organization" o
    ORDER BY o."name" ASC
    `,
    getOutcomeAttentionRollupByOrganization(),
  ]);

  const extraCardRows = await prisma.cmsEntry.findMany({
    where: { key: SCHOOL_PUBLIC_EXTRA_CARDS_KEY },
    select: { organizationId: true, value: true },
  });
  const extraSectionsByOrg = new Map<string, number>();
  for (const row of extraCardRows) {
    extraSectionsByOrg.set(row.organizationId, parseSchoolPublicExtraCards(row.value).length);
  }

  return raw.map((row) => {
    const base = normalizeRow(row);
    const outcome = outcomeByOrg.get(base.id) ?? { publishedAssessments: 0, outcomeAttentionAssessments: 0 };
    const counts: TenantUsageCounts = {
      ...base,
      publicExtraSections: extraSectionsByOrg.get(base.id) ?? 0,
      publishedAssessments: outcome.publishedAssessments,
      outcomeAttentionAssessments: outcome.outcomeAttentionAssessments,
    };
    const forWeightedIndex: TenantUsageCounts = {
      ...counts,
      publicExtraSections: Math.min(counts.publicExtraSections, PUBLIC_EXTRA_SECTIONS_WEIGHT_CAP),
    };
    return {
      ...counts,
      weightedUsageIndex: computeWeightedUsageIndex(forWeightedIndex),
      totalDataRows: computeTotalDataRows(counts),
      momentumIndex7: computeMomentumIndex(
        counts.submissionsLast7Days,
        counts.usersJoinedLast7Days,
        counts.enrollmentsLast7Days,
      ),
      momentumIndex30: computeMomentumIndex(
        counts.submissionsLast30Days,
        counts.usersJoinedLast30Days,
        counts.enrollmentsLast30Days,
      ),
      momentumIndex90: computeMomentumIndex(
        counts.submissionsLast90Days,
        counts.usersJoinedLast90Days,
        counts.enrollmentsLast90Days,
      ),
    };
  });
}
