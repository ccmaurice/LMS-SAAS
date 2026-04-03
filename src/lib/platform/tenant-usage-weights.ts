/**
 * Custom public sections above this count still show in analytics tables and CSV, but only this many
 * multiply `USAGE_WEIGHTS.publicExtraSections` in the weighted index (half of `MAX_SCHOOL_PUBLIC_EXTRA_CARDS` in
 * school-public — rewards rich pages without letting 24 cards dominate billing).
 */
export const PUBLIC_EXTRA_SECTIONS_WEIGHT_CAP = 12;

/** Weights emphasize grading traffic, enrollments, seats, and rich content. */
export const USAGE_WEIGHTS = {
  users: 4,
  students: 2,
  teachers: 3,
  parents: 1,
  admins: 2,
  courses: 6,
  enrollments: 4,
  modules: 2,
  lessons: 2,
  lessonFiles: 5,
  assessments: 5,
  questions: 1,
  submissions: 12,
  answers: 5,
  courseChatMessages: 1,
  learningResources: 4,
  blogPosts: 2,
  /** Org-wide school calendar rows (dashboard + notifications surface). */
  schoolCalendarEvents: 2,
  /** Per-assessment schedule windows (CA opens/due, exam windows); extra rows beyond legacy open/due on Assessment. */
  assessmentScheduleEntries: 2,
  /** Public school page custom sections (JSON cards); same per-unit weight as `cmsEntries` (one card ≈ one surfaced block). */
  publicExtraSections: 1,
  cmsEntries: 1,
  orgMessages: 1,
  dmThreads: 2,
  dmMessages: 1,
  notifications: 1,
  invites: 1,
  cohorts: 2,
  cohortMemberships: 2,
  proctoringEvents: 3,
  lessonProgressRows: 2,
  resourceProgressRows: 2,
  gradingAuditLogs: 2,
  /** Submitted assessments in the rolling last 30 days (current load). */
  submissionsLast30Days: 8,
  /** New org members in the last 30 days (growth). */
  usersJoinedLast30Days: 3,
  /** New course enrollments in the last 30 days (activation). */
  enrollmentsLast30Days: 3,
} as const;

/**
 * Momentum-only score: recent submissions + signups + enrollments for one window.
 * Tune independently from USAGE_WEIGHTS (main index still blends stock + 30d activity).
 */
export const MOMENTUM_WEIGHTS = {
  submissions: 10,
  usersJoined: 4,
  enrollments: 4,
} as const;
