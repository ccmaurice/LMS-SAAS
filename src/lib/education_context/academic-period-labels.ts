import type { EducationLevel } from "@/generated/prisma/enums";

/** Labels for org-defined `AcademicTerm` rows: K–12 use “term”; higher ed uses “semester” for the same model. */
export function academicCalendarCopy(level: EducationLevel) {
  const he = level === "HIGHER_ED";
  const periodSingular = he ? "semester" : "term";
  const periodPlural = he ? "semesters" : "terms";
  return {
    navLabel: he ? "Academic semesters" : "Academic terms",
    pageTitle: he ? "Academic semesters" : "Academic terms",
    periodSingular,
    periodPlural,
    periodSingularCapitalized: he ? "Semester" : "Term",
    periodPluralCapitalized: he ? "Semesters" : "Terms",
    /** `transcriptScopeDescription` */
    scopePeriodLabels: { singular: periodSingular, plural: periodPlural },
    createEntityLabel: he ? "semester" : "term",
    courseFieldLabel: he ? "Academic semester" : "Academic term",
    gradingPanelAdminRef: he ? "Admin → Academic semesters" : "Admin → Academic terms",
    schoolSettingsBlurb: he
      ? "Academic semesters (codes and labels) and per-course credit hours for transcripts."
      : "Academic terms (within the school year) and per-course setup for transcripts.",
    adminPageLead: he
      ? "Semesters appear on courses for transcript filtering and as the school “current semester” for students."
      : "Terms appear on courses for transcript filtering and as the school “current term” for students.",
    assessmentRollupsNote:
      "Assessment semesters (1–3) inside a course still drive grades and promotion rollups—they are separate from this calendar list.",
  };
}

export type AcademicCalendarCopy = ReturnType<typeof academicCalendarCopy>;
