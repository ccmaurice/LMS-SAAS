import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import type { AssessmentScheduleKind } from "@/generated/prisma/enums";
import {
  assessmentVisibilityWhereForEnrolledStudent,
  canStudentViewAssessment,
} from "@/lib/assessments/access";
import {
  legacyAssessmentDateWindowOr,
  scheduleEntryTitle,
  scheduleEntryWhereOverlapsRange,
} from "@/lib/assessment-schedule/entry-calendar";
import type { DashboardCalendarItemJson } from "@/lib/calendar/dashboard-calendar-shared";

export type { DashboardCalendarItemSource, DashboardCalendarItemJson } from "@/lib/calendar/dashboard-calendar-shared";
export { defaultDashboardCalendarRange } from "@/lib/calendar/dashboard-calendar-shared";

const assessmentInclude = {
  course: {
    select: {
      id: true,
      title: true,
      organizationId: true,
      organization: { select: { educationLevel: true } },
    },
  },
  assessmentCohorts: { select: { cohortId: true } },
  assessmentDepartments: { select: { departmentId: true } },
} as const;

type AssessmentForVis = Prisma.AssessmentGetPayload<{ include: typeof assessmentInclude }>;

function schoolKindAccent(kind: string): DashboardCalendarItemJson["accent"] {
  switch (kind) {
    case "RESUMPTION":
      return "emerald";
    case "CLOSURE":
    case "HOLIDAY":
      return "rose";
    case "EVENT":
      return "violet";
    case "ACTIVITY":
      return "sky";
    default:
      return "slate";
  }
}

function assessmentAccent(kind: "QUIZ" | "EXAM"): DashboardCalendarItemJson["accent"] {
  return kind === "EXAM" ? "amber" : "violet";
}

function pushLegacyAssessment(
  base: string,
  assessmentItems: DashboardCalendarItemJson[],
  a: {
    id: string;
    title: string;
    kind: "QUIZ" | "EXAM";
    courseId: string;
    courseTitle: string;
    availableFrom: Date | null;
    dueAt: Date | null;
  },
  rangeStart: Date,
  rangeEnd: Date,
  labelPrefix?: string,
  idSuffix = "",
) {
  const coursePart = labelPrefix ? `${labelPrefix} · ${a.courseTitle}` : a.courseTitle;
  if (a.availableFrom && a.availableFrom >= rangeStart && a.availableFrom < rangeEnd) {
    assessmentItems.push({
      id: `asmt-open:${a.id}${idSuffix}`,
      source: "assessment",
      kind: "AVAILABLE",
      title: `${a.kind === "EXAM" ? "Exam" : "Quiz"} opens: ${a.title}`,
      subtitle: coursePart,
      startsAt: a.availableFrom.toISOString(),
      endsAt: null,
      allDay: false,
      href: `${base}/courses/${a.courseId}/assessments/${a.id}/take`,
      accent: assessmentAccent(a.kind),
    });
  }
  if (a.dueAt && a.dueAt >= rangeStart && a.dueAt < rangeEnd) {
    assessmentItems.push({
      id: `asmt-due:${a.id}${idSuffix}`,
      source: "assessment",
      kind: "DUE",
      title: `${a.kind === "EXAM" ? "Exam" : "Quiz"} due: ${a.title}`,
      subtitle: coursePart,
      startsAt: a.dueAt.toISOString(),
      endsAt: null,
      allDay: false,
      href: `${base}/courses/${a.courseId}/assessments/${a.id}/take`,
      accent: assessmentAccent(a.kind),
    });
  }
}

function pushScheduleEntry(
  base: string,
  assessmentItems: DashboardCalendarItemJson[],
  entry: {
    id: string;
    kind: string;
    startsAt: Date;
    endsAt: Date | null;
    allDay: boolean;
    label: string | null;
  },
  a: AssessmentForVis,
  rangeStart: Date,
  rangeEnd: Date,
  labelPrefix?: string,
  idSuffix = "",
) {
  const t0 = entry.startsAt.getTime();
  const t1 = entry.endsAt?.getTime() ?? t0;
  const rs = rangeStart.getTime();
  const re = rangeEnd.getTime();
  const overlaps = t0 < re && t1 >= rs;
  if (!overlaps) return;

  const coursePart = labelPrefix
    ? `${labelPrefix} · ${a.course.title}`
    : a.course.title;
  const title = scheduleEntryTitle(entry.kind as AssessmentScheduleKind, a.title, a.kind, entry.label);

  assessmentItems.push({
    id: `sched:${entry.id}${idSuffix}`,
    source: "assessment",
    kind: entry.kind,
    title,
    subtitle: coursePart,
    startsAt: entry.startsAt.toISOString(),
    endsAt: entry.endsAt?.toISOString() ?? null,
    allDay: entry.allDay,
    href: `${base}/courses/${a.courseId}/assessments/${a.id}/take`,
    accent: assessmentAccent(a.kind),
  });
}

export async function fetchDashboardCalendarItems(opts: {
  organizationId: string;
  orgSlug: string;
  userId: string;
  role: Role;
  parentChildIds: string[];
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<DashboardCalendarItemJson[]> {
  const { organizationId, orgSlug, userId, role, parentChildIds, rangeStart, rangeEnd } = opts;
  const base = `/o/${orgSlug}`;

  const schoolRows = await prisma.schoolCalendarEvent.findMany({
    where: {
      organizationId,
      AND: [
        { startsAt: { lt: rangeEnd } },
        {
          OR: [{ endsAt: null }, { endsAt: { gte: rangeStart } }],
        },
      ],
    },
    orderBy: { startsAt: "asc" },
  });

  const schoolItems: DashboardCalendarItemJson[] = schoolRows.map((e) => ({
    id: `school:${e.id}`,
    source: "school",
    kind: e.kind,
    title: e.title,
    subtitle: e.description ? e.description.slice(0, 120) + (e.description.length > 120 ? "…" : "") : null,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    allDay: e.allDay,
    href: null,
    accent: schoolKindAccent(e.kind),
  }));

  const assessmentItems: DashboardCalendarItemJson[] = [];

  const overlap = scheduleEntryWhereOverlapsRange(rangeStart, rangeEnd);
  const legacyOr: Prisma.AssessmentWhereInput = { OR: legacyAssessmentDateWindowOr(rangeStart, rangeEnd) };

  if (role === "ADMIN") {
    const entries = await prisma.assessmentScheduleEntry.findMany({
      where: {
        AND: [
          overlap,
          {
            assessment: {
              published: true,
              course: { organizationId },
            },
          },
        ],
      },
      include: { assessment: { include: assessmentInclude } },
      orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
    });
    for (const row of entries) {
      pushScheduleEntry(base, assessmentItems, row, row.assessment, rangeStart, rangeEnd);
    }
    const legacy = await prisma.assessment.findMany({
      where: {
        published: true,
        course: { organizationId },
        scheduleEntries: { none: {} },
        ...legacyOr,
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
      pushLegacyAssessment(
        base,
        assessmentItems,
        {
          id: a.id,
          title: a.title,
          kind: a.kind,
          courseId: a.courseId,
          courseTitle: a.course.title,
          availableFrom: a.availableFrom,
          dueAt: a.dueAt,
        },
        rangeStart,
        rangeEnd,
      );
    }
  } else if (role === "TEACHER") {
    const entries = await prisma.assessmentScheduleEntry.findMany({
      where: {
        AND: [
          overlap,
          {
            assessment: {
              published: true,
              course: { organizationId, createdById: userId },
            },
          },
        ],
      },
      include: { assessment: { include: assessmentInclude } },
      orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
    });
    for (const row of entries) {
      pushScheduleEntry(base, assessmentItems, row, row.assessment, rangeStart, rangeEnd);
    }
    const legacy = await prisma.assessment.findMany({
      where: {
        published: true,
        course: { organizationId, createdById: userId },
        scheduleEntries: { none: {} },
        ...legacyOr,
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
      pushLegacyAssessment(
        base,
        assessmentItems,
        {
          id: a.id,
          title: a.title,
          kind: a.kind,
          courseId: a.courseId,
          courseTitle: a.course.title,
          availableFrom: a.availableFrom,
          dueAt: a.dueAt,
        },
        rangeStart,
        rangeEnd,
      );
    }
  } else if (role === "STUDENT") {
    const vis = await assessmentVisibilityWhereForEnrolledStudent(userId, organizationId);
    const entries = await prisma.assessmentScheduleEntry.findMany({
      where: {
        AND: [
          overlap,
          {
            assessment: {
              published: true,
              course: {
                organizationId,
                enrollments: { some: { userId } },
              },
            },
          },
        ],
      },
      include: { assessment: { include: assessmentInclude } },
      orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
    });
    for (const row of entries) {
      const ok = await canStudentViewAssessment(userId, "STUDENT", row.assessment);
      if (!ok) continue;
      pushScheduleEntry(base, assessmentItems, row, row.assessment, rangeStart, rangeEnd);
    }
    const legacy = await prisma.assessment.findMany({
      where: {
        published: true,
        course: {
          organizationId,
          enrollments: { some: { userId } },
        },
        scheduleEntries: { none: {} },
        AND: [vis, legacyOr],
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
      pushLegacyAssessment(
        base,
        assessmentItems,
        {
          id: a.id,
          title: a.title,
          kind: a.kind,
          courseId: a.courseId,
          courseTitle: a.course.title,
          availableFrom: a.availableFrom,
          dueAt: a.dueAt,
        },
        rangeStart,
        rangeEnd,
      );
    }
  } else if (role === "PARENT" && parentChildIds.length > 0) {
    for (const childId of parentChildIds) {
      const vis = await assessmentVisibilityWhereForEnrolledStudent(childId, organizationId);
      const child = await prisma.user.findUnique({
        where: { id: childId },
        select: { name: true, email: true },
      });
      const childLabel = child?.name?.trim() || child?.email || "Student";

      const entries = await prisma.assessmentScheduleEntry.findMany({
        where: {
          AND: [
            overlap,
            {
              assessment: {
                published: true,
                course: {
                  organizationId,
                  enrollments: { some: { userId: childId } },
                },
              },
            },
          ],
        },
        include: { assessment: { include: assessmentInclude } },
        orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
      });
      for (const row of entries) {
        const ok = await canStudentViewAssessment(childId, "STUDENT", row.assessment);
        if (!ok) continue;
        pushScheduleEntry(
          base,
          assessmentItems,
          row,
          row.assessment,
          rangeStart,
          rangeEnd,
          childLabel,
          `:c:${childId}`,
        );
      }

      const legacy = await prisma.assessment.findMany({
        where: {
          published: true,
          course: {
            organizationId,
            enrollments: { some: { userId: childId } },
          },
          scheduleEntries: { none: {} },
          AND: [vis, legacyOr],
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
        pushLegacyAssessment(
          base,
          assessmentItems,
          {
            id: a.id,
            title: a.title,
            kind: a.kind,
            courseId: a.courseId,
            courseTitle: a.course.title,
            availableFrom: a.availableFrom,
            dueAt: a.dueAt,
          },
          rangeStart,
          rangeEnd,
          childLabel,
          `:c:${childId}`,
        );
      }
    }
  }

  const merged = [...schoolItems, ...assessmentItems].sort(
    (x, y) => new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime(),
  );
  return merged;
}
