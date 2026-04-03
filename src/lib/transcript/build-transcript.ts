import type { EducationLevel, GradingScaleType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getEducationContext } from "@/lib/education_context";
import type { OrganizationSettings } from "@/lib/education_context/schema";
import { computeCourseSemesterGrade } from "@/lib/grading/course-grade";
import { formatGradeDisplay, gpaFromPercent, letterFromPercent } from "@/lib/grading_engine/letter-gpa";
import { resolveTranscriptTermIds } from "@/lib/transcript/academic-term-scope";
import type { TranscriptTermScope } from "@/lib/transcript/academic-term-scope.shared";

export type TranscriptCourseRow = {
  courseId: string;
  courseTitle: string;
  credits: number;
  termLabel: string | null;
  percent: number | null;
  letterDisplay: string | null;
  gpaPoints: number | null;
  qualityPoints: number | null;
};

export type SemesterGpaSummary = {
  semester: 1 | 2 | 3;
  /** Credit-weighted mean percent for courses with data this semester */
  avgPercent: number | null;
  /** Credit-weighted term GPA (higher-ed only) */
  termGpa: number | null;
  /** Credits that contributed to term GPA */
  creditsCounted: number;
};

export type TranscriptPayload = {
  educationLevel: EducationLevel;
  rows: TranscriptCourseRow[];
  cumulativeGpa: number | null;
  totalCreditsGraded: number;
  totalQualityPoints: number;
  /** Per-semester (1–3) rollups for higher-ed GPA tracking */
  semesterSummaries: SemesterGpaSummary[];
  /** Assessment semesters 1–3 within the filtered course set (promotion / in-course tagging). */
  termScope: TranscriptTermScope;
};

const DEFAULT_CREDIT_HOURS = 3;

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

type EnrollmentRow = {
  course: {
    id: string;
    creditHours: number | null;
    gradeWeightContinuous: number;
    gradeWeightExam: number;
    gradingScale: GradingScaleType;
  };
};

async function computeSemesterSummaries(
  enrollments: EnrollmentRow[],
  userId: string,
  organizationId: string,
  educationLevel: EducationLevel,
  orgSettings: OrganizationSettings,
): Promise<SemesterGpaSummary[]> {
  const summaries: SemesterGpaSummary[] = [];

  for (const sem of [1, 2, 3] as const) {
    let weightedPercent = 0;
    let creditsForPercent = 0;
    let qualityPoints = 0;
    let creditsForGpa = 0;

    for (const e of enrollments) {
      const c = e.course;
      const credits = c.creditHours != null && c.creditHours > 0 ? c.creditHours : DEFAULT_CREDIT_HOURS;
      const g = await computeCourseSemesterGrade({
        userId,
        courseId: c.id,
        semester: sem,
        weightContinuous: c.gradeWeightContinuous,
        weightExam: c.gradeWeightExam,
        organizationId,
        gradingScale: c.gradingScale as GradingScaleType,
      });
      if (g?.percent == null) continue;
      weightedPercent += g.percent * credits;
      creditsForPercent += credits;
      if (educationLevel === "HIGHER_ED") {
        const gp = gpaFromPercent(g.percent, orgSettings);
        if (gp != null) {
          qualityPoints += gp * credits;
          creditsForGpa += credits;
        }
      }
    }

    const avgPercent = creditsForPercent > 0 ? weightedPercent / creditsForPercent : null;
    const termGpa =
      educationLevel === "HIGHER_ED" && creditsForGpa > 0
        ? Math.round((qualityPoints / creditsForGpa) * 100) / 100
        : null;

    summaries.push({
      semester: sem,
      avgPercent,
      termGpa,
      creditsCounted: creditsForGpa,
    });
  }

  return summaries;
}

/**
 * Official-style course list with per-course GPA (higher-ed) and cumulative GPA on graded credits.
 * @param termScope Filter by course `academicTermId` (Admin calendar: “terms” for K–12, “semesters” for higher ed). Courses without a period are omitted when filtering — assign on each course for accurate transcripts across promotions.
 */
export async function buildStudentTranscript(
  userId: string,
  organizationId: string,
  termScope: TranscriptTermScope = { kind: "all" },
): Promise<TranscriptPayload> {
  const ctx = await getEducationContext(organizationId);
  const educationLevel = ctx?.educationLevel ?? "SECONDARY";
  const orgSettings: OrganizationSettings = ctx?.settings ?? {};

  const allowedTermIds = await resolveTranscriptTermIds(organizationId, termScope);

  const enrollments =
    allowedTermIds !== null && allowedTermIds.size === 0
      ? []
      : await prisma.enrollment.findMany({
          where: {
            userId,
            course: {
              organizationId,
              ...(allowedTermIds != null ? { academicTermId: { in: [...allowedTermIds] } } : {}),
            },
          },
          include: {
            course: {
              include: {
                academicTerm: { select: { label: true } },
              },
            },
          },
          orderBy: { enrolledAt: "asc" },
        });

  const rows: TranscriptCourseRow[] = [];

  for (const e of enrollments) {
    const c = e.course;
    const credits = c.creditHours != null && c.creditHours > 0 ? c.creditHours : DEFAULT_CREDIT_HOURS;
    const termLabel = c.academicTerm?.label ?? null;
    const gradingScale = c.gradingScale as GradingScaleType;

    const semesterPercents: number[] = [];
    for (const sem of [1, 2, 3] as const) {
      const g = await computeCourseSemesterGrade({
        userId,
        courseId: c.id,
        semester: sem,
        weightContinuous: c.gradeWeightContinuous,
        weightExam: c.gradeWeightExam,
        organizationId,
        gradingScale,
      });
      if (g?.percent != null) semesterPercents.push(g.percent);
    }

    const percent = average(semesterPercents);

    let letterDisplay: string | null = null;
    let gpaPoints: number | null = null;
    let qualityPoints: number | null = null;

    if (percent != null) {
      letterDisplay = formatGradeDisplay(percent, gradingScale, orgSettings);
      if (educationLevel === "HIGHER_ED") {
        if (gradingScale === "PERCENTAGE") {
          const letter = letterFromPercent(percent, orgSettings);
          letterDisplay = `${Math.round(percent)}% (${letter})`;
        }
        const gp = gpaFromPercent(percent, orgSettings);
        if (gp != null) {
          gpaPoints = gp;
          qualityPoints = gp * credits;
        }
      }
    }

    rows.push({
      courseId: c.id,
      courseTitle: c.title,
      credits,
      termLabel,
      percent,
      letterDisplay,
      gpaPoints,
      qualityPoints,
    });
  }

  let totalQualityPoints = 0;
  let totalCreditsGraded = 0;
  for (const r of rows) {
    if (r.qualityPoints != null && r.gpaPoints != null) {
      totalQualityPoints += r.qualityPoints;
      totalCreditsGraded += r.credits;
    }
  }

  const cumulativeGpa =
    educationLevel === "HIGHER_ED" && totalCreditsGraded > 0
      ? Math.round((totalQualityPoints / totalCreditsGraded) * 100) / 100
      : null;

  const semesterSummaries = await computeSemesterSummaries(
    enrollments,
    userId,
    organizationId,
    educationLevel,
    orgSettings,
  );

  return {
    educationLevel,
    rows,
    cumulativeGpa,
    totalCreditsGraded,
    totalQualityPoints,
    semesterSummaries,
    termScope,
  };
}
