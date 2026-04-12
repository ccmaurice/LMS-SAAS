import type { Prisma } from "@/generated/prisma/client";

/**
 * Rolling activity filters shared with platform tenant usage SQL (`tenant-usage.ts`):
 * submissions with non-null `submittedAt` in org courses; lesson completions with non-null `completedAt`
 * on progress rows tied to lessons in org courses. PostgreSQL uses `NOW() - INTERVAL 'N days'`; school
 * admin passes the same wall-clock cutoff computed in JS at request time.
 */

export function orgSubmissionsRollingWhere(organizationId: string, since: Date): Prisma.SubmissionWhereInput {
  return {
    AND: [{ submittedAt: { not: null } }, { submittedAt: { gte: since } }],
    assessment: { course: { organizationId } },
  };
}

export function orgLessonCompletionsRollingWhere(organizationId: string, since: Date): Prisma.LessonProgressWhereInput {
  // `completedAt` is required on LessonProgress; platform SQL still uses `IS NOT NULL` for clarity.
  return {
    completedAt: { gte: since },
    lesson: { module: { course: { organizationId } } },
  };
}
