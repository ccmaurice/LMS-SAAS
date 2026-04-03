import { prisma } from "@/lib/db";
import type { AssessmentScheduleKind, Role } from "@/generated/prisma/enums";
import {
  assessmentVisibilityWhereForEnrolledStudent,
  canStudentViewAssessment,
} from "@/lib/assessments/access";
import { scheduleEntryTitle } from "@/lib/assessment-schedule/entry-calendar";

const LINK_FRAGMENT = "#school-calendar";

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

async function notifyOnce(userId: string, dedupeKey: string, title: string, body: string | null, link: string) {
  const existing = await prisma.calendarNotificationDedupe.findUnique({
    where: { userId_dedupeKey: { userId, dedupeKey } },
  });
  if (existing) return;
  await prisma.$transaction([
    prisma.notification.create({ data: { userId, title, body, link } }),
    prisma.calendarNotificationDedupe.create({ data: { userId, dedupeKey } }),
  ]);
}

function entryNotifyTitle(kind: AssessmentScheduleKind, assessmentTitle: string): string {
  if (kind === "CA_DUE") return `Due soon: ${assessmentTitle}`;
  if (kind === "EXAM_WINDOW") return `Exam window soon: ${assessmentTitle}`;
  return `Opens soon: ${assessmentTitle}`;
}

/**
 * Creates in-app notifications for upcoming school-wide and assessment calendar items (idempotent per user).
 * Call from dashboard (server) on each load — cheap due to dedupe keys.
 */
export async function ensureUpcomingCalendarNotifications(opts: {
  userId: string;
  organizationId: string;
  orgSlug: string;
  role: Role;
  parentChildIds: string[];
}) {
  const { userId, organizationId, orgSlug, role, parentChildIds } = opts;
  const now = new Date();
  const horizon = addDays(now, 10);
  const dashLink = `/o/${orgSlug}/dashboard${LINK_FRAGMENT}`;

  const schoolEvents = await prisma.schoolCalendarEvent.findMany({
    where: {
      organizationId,
      startsAt: { gte: now, lte: horizon },
    },
    select: { id: true, title: true, startsAt: true, kind: true },
  });

  for (const e of schoolEvents) {
    const when = e.startsAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    await notifyOnce(
      userId,
      `sch-cal:${e.id}`,
      `School calendar: ${e.title}`,
      `${e.kind.replace(/_/g, " ")} · ${when}`,
      dashLink,
    );
  }

  const assessmentInclude = {
    course: {
      select: {
        title: true,
        organizationId: true,
        organization: { select: { educationLevel: true } },
      },
    },
    assessmentCohorts: { select: { cohortId: true } },
    assessmentDepartments: { select: { departmentId: true } },
  } as const;

  if (role === "STUDENT") {
    const vis = await assessmentVisibilityWhereForEnrolledStudent(userId, organizationId);

    const schedRows = await prisma.assessmentScheduleEntry.findMany({
      where: {
        startsAt: { gte: now, lte: horizon },
        assessment: {
          published: true,
          course: {
            organizationId,
            enrollments: { some: { userId } },
          },
        },
      },
      include: { assessment: { include: assessmentInclude } },
    });

    for (const row of schedRows) {
      const ok = await canStudentViewAssessment(userId, "STUDENT", row.assessment);
      if (!ok) continue;
      const base = `/o/${orgSlug}/courses/${row.assessment.courseId}/assessments/${row.assessment.id}/take`;
      const body = scheduleEntryTitle(
        row.kind,
        row.assessment.title,
        row.assessment.kind,
        row.label,
      );
      await notifyOnce(
        userId,
        `sched:${row.id}`,
        entryNotifyTitle(row.kind, row.assessment.title),
        `${row.assessment.kind} · ${row.assessment.course.title} · ${body}`,
        base,
      );
    }

    const legacy = await prisma.assessment.findMany({
      where: {
        published: true,
        scheduleEntries: { none: {} },
        course: {
          organizationId,
          enrollments: { some: { userId } },
        },
        AND: [
          vis,
          {
            OR: [
              { dueAt: { gte: now, lte: horizon } },
              { availableFrom: { gte: now, lte: horizon } },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        kind: true,
        courseId: true,
        availableFrom: true,
        dueAt: true,
        course: { select: { title: true } },
      },
    });
    for (const a of legacy) {
      const base = `/o/${orgSlug}/courses/${a.courseId}/assessments/${a.id}/take`;
      if (a.dueAt && a.dueAt >= now && a.dueAt <= horizon) {
        await notifyOnce(
          userId,
          `asmt-due:${a.id}`,
          `Due soon: ${a.title}`,
          `${a.kind} · ${a.course.title}`,
          base,
        );
      }
      if (a.availableFrom && a.availableFrom >= now && a.availableFrom <= horizon) {
        await notifyOnce(
          userId,
          `asmt-open:${a.id}`,
          `Opens soon: ${a.title}`,
          `${a.kind} · ${a.course.title}`,
          base,
        );
      }
    }
  }

  if (role === "PARENT" && parentChildIds.length > 0) {
    for (const childId of parentChildIds) {
      const vis = await assessmentVisibilityWhereForEnrolledStudent(childId, organizationId);
      const child = await prisma.user.findUnique({
        where: { id: childId },
        select: { name: true, email: true },
      });
      const childLabel = child?.name?.trim() || child?.email || "Student";

      const schedRows = await prisma.assessmentScheduleEntry.findMany({
        where: {
          startsAt: { gte: now, lte: horizon },
          assessment: {
            published: true,
            course: {
              organizationId,
              enrollments: { some: { userId: childId } },
            },
          },
        },
        include: { assessment: { include: assessmentInclude } },
      });

      for (const row of schedRows) {
        const ok = await canStudentViewAssessment(childId, "STUDENT", row.assessment);
        if (!ok) continue;
        const base = `/o/${orgSlug}/courses/${row.assessment.courseId}/assessments/${row.assessment.id}/take`;
        const body = scheduleEntryTitle(
          row.kind,
          row.assessment.title,
          row.assessment.kind,
          row.label,
        );
        await notifyOnce(
          userId,
          `sched:${row.id}:c:${childId}`,
          `${entryNotifyTitle(row.kind, row.assessment.title)} (${childLabel})`,
          `${row.assessment.kind} · ${row.assessment.course.title} · ${body}`,
          base,
        );
      }

      const legacy = await prisma.assessment.findMany({
        where: {
          published: true,
          scheduleEntries: { none: {} },
          course: {
            organizationId,
            enrollments: { some: { userId: childId } },
          },
          AND: [
            vis,
            {
              OR: [
                { dueAt: { gte: now, lte: horizon } },
                { availableFrom: { gte: now, lte: horizon } },
              ],
            },
          ],
        },
        select: {
          id: true,
          title: true,
          kind: true,
          courseId: true,
          availableFrom: true,
          dueAt: true,
          course: { select: { title: true } },
        },
      });
      for (const a of legacy) {
        const base = `/o/${orgSlug}/courses/${a.courseId}/assessments/${a.id}/take`;
        if (a.dueAt && a.dueAt >= now && a.dueAt <= horizon) {
          await notifyOnce(
            userId,
            `asmt-due:${a.id}:c:${childId}`,
            `Due soon: ${a.title} (${childLabel})`,
            `${a.kind} · ${a.course.title}`,
            base,
          );
        }
        if (a.availableFrom && a.availableFrom >= now && a.availableFrom <= horizon) {
          await notifyOnce(
            userId,
            `asmt-open:${a.id}:c:${childId}`,
            `Opens soon: ${a.title} (${childLabel})`,
            `${a.kind} · ${a.course.title}`,
            base,
          );
        }
      }
    }
  }

  if (role === "TEACHER") {
    const schedRows = await prisma.assessmentScheduleEntry.findMany({
      where: {
        startsAt: { gte: now, lte: horizon },
        assessment: {
          published: true,
          course: { organizationId, createdById: userId },
        },
      },
      include: { assessment: { include: { course: { select: { title: true } } } } },
    });

    for (const row of schedRows) {
      const base = `/o/${orgSlug}/courses/${row.assessment.courseId}/assessments/${row.assessment.id}/edit`;
      await notifyOnce(
        userId,
        `sched-teach:${row.id}`,
        `Calendar: ${entryNotifyTitle(row.kind, row.assessment.title)}`,
        row.assessment.course.title,
        base,
      );
    }

    const legacy = await prisma.assessment.findMany({
      where: {
        published: true,
        scheduleEntries: { none: {} },
        course: { organizationId, createdById: userId },
        OR: [
          { dueAt: { gte: now, lte: horizon } },
          { availableFrom: { gte: now, lte: horizon } },
        ],
      },
      select: {
        id: true,
        title: true,
        kind: true,
        courseId: true,
        availableFrom: true,
        dueAt: true,
        course: { select: { title: true } },
      },
    });
    for (const a of legacy) {
      const base = `/o/${orgSlug}/courses/${a.courseId}/assessments/${a.id}/edit`;
      if (a.dueAt && a.dueAt >= now && a.dueAt <= horizon) {
        await notifyOnce(
          userId,
          `asmt-due-teach:${a.id}`,
          `Reminder: ${a.title} due soon`,
          `${a.kind} · ${a.course.title}`,
          base,
        );
      }
      if (a.availableFrom && a.availableFrom >= now && a.availableFrom <= horizon) {
        await notifyOnce(
          userId,
          `asmt-open-teach:${a.id}`,
          `Reminder: ${a.title} opens soon`,
          `${a.kind} · ${a.course.title}`,
          base,
        );
      }
    }
  }
}
