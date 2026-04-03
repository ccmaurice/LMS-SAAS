import type { Prisma } from "@/generated/prisma/client";
import type { AssessmentScheduleKind } from "@/generated/prisma/enums";

/** Entries whose time span intersects [rangeStart, rangeEnd). */
export function scheduleEntryWhereOverlapsRange(
  rangeStart: Date,
  rangeEnd: Date,
): Prisma.AssessmentScheduleEntryWhereInput {
  return {
    AND: [
      { startsAt: { lt: rangeEnd } },
      {
        OR: [
          {
            AND: [{ endsAt: null }, { startsAt: { gte: rangeStart, lt: rangeEnd } }],
          },
          {
            AND: [
              { endsAt: { not: null } },
              { startsAt: { lt: rangeEnd } },
              { endsAt: { gte: rangeStart } },
            ],
          },
        ],
      },
    ],
  };
}

export function scheduleEntryTitle(
  kind: AssessmentScheduleKind,
  assessmentTitle: string,
  quizOrExam: "QUIZ" | "EXAM",
  customLabel: string | null | undefined,
): string {
  const t = customLabel?.trim();
  if (t) return t;
  if (kind === "EXAM_WINDOW") {
    return `${quizOrExam === "EXAM" ? "Exam" : "Quiz"} window: ${assessmentTitle}`;
  }
  if (kind === "CA_DUE") {
    return `${quizOrExam === "EXAM" ? "Exam" : "Quiz"} due: ${assessmentTitle}`;
  }
  return `${quizOrExam === "EXAM" ? "Exam" : "Quiz"} opens: ${assessmentTitle}`;
}

export function legacyAssessmentDateWindowOr(
  rangeStart: Date,
  rangeEnd: Date,
): Prisma.AssessmentWhereInput["OR"] {
  return [
    {
      AND: [{ dueAt: { not: null } }, { dueAt: { gte: rangeStart, lt: rangeEnd } }],
    },
    {
      AND: [
        { availableFrom: { not: null } },
        { availableFrom: { gte: rangeStart, lt: rangeEnd } },
      ],
    },
    {
      AND: [
        { availableFrom: { not: null, lt: rangeEnd } },
        { dueAt: { not: null, gte: rangeStart } },
      ],
    },
  ];
}
