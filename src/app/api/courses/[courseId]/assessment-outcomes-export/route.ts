import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCourseInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
import { isStaffRole } from "@/lib/courses/access";
import { deliveryModeShortLabel } from "@/lib/assessments/delivery-mode";
import {
  assessmentOutcomeHealth,
  assessmentOutcomeNeedsAttention,
} from "@/lib/assessments/assessment-outcome-health";
import {
  parseOutcomesListFilters,
  submitParticipationPercent,
  summarizeOutcomeSubmissions,
} from "@/lib/assessments/course-assessment-outcomes";

function esc(s: string): string {
  return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

export async function GET(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaffRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const course = await assertCourseInOrg(courseId, user.organizationId);
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canTeacherActOnAssessmentCourse(user, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const filters = parseOutcomesListFilters(Object.fromEntries(url.searchParams.entries()));

  const enrolledCount = await prisma.enrollment.count({ where: { courseId } });

  const assessments = await prisma.assessment.findMany({
    where: {
      courseId,
      ...(filters.show === "published" ? { published: true } : {}),
      ...(filters.kind !== "all" ? { kind: filters.kind } : {}),
    },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      published: true,
      kind: true,
      deliveryMode: true,
      questions: { select: { id: true } },
      submissions: {
        where: { status: "SUBMITTED" },
        select: { totalScore: true, maxScore: true, userId: true },
      },
      questionPools: {
        select: { _count: { select: { entries: true } } },
      },
    },
  });

  const ids = assessments.map((a) => a.id);
  const integrityGroups =
    ids.length > 0
      ? await prisma.proctoringEvent.groupBy({
          by: ["assessmentId"],
          where: { assessmentId: { in: ids } },
          _count: { id: true },
        })
      : [];
  const integrityByAssessment = new Map(integrityGroups.map((g) => [g.assessmentId, g._count.id]));

  const exportRows =
    filters.attention === "flagged"
      ? assessments.filter((a) => {
          const summary = summarizeOutcomeSubmissions(a.submissions);
          const particip = submitParticipationPercent(summary.distinctStudents, enrolledCount);
          return assessmentOutcomeNeedsAttention({
            published: a.published,
            mean: summary.mean,
            scoredAttemptCount: summary.scoredAttemptCount,
            participationPercent: particip,
            enrolledCount,
          });
        })
      : assessments;

  const header = [
    "title",
    "kind",
    "published",
    "deliveryMode",
    "questionCount",
    "usesPools",
    "attemptCount",
    "scoredAttemptCount",
    "distinctStudents",
    "enrolledCount",
    "participationPercent",
    "medianScorePercent",
    "meanScorePercent",
    "flagLowMean",
    "flagLowReach",
    "minScorePercent",
    "maxScorePercent",
    "integrityEventCount",
  ];
  const lines = [
    header.join("\t"),
    ...exportRows.map((a) => {
      const summary = summarizeOutcomeSubmissions(a.submissions);
      const usesPools = a.questionPools.some((p) => p._count.entries > 0);
      const particip = submitParticipationPercent(summary.distinctStudents, enrolledCount);
      const health = assessmentOutcomeHealth({
        published: a.published,
        mean: summary.mean,
        scoredAttemptCount: summary.scoredAttemptCount,
        participationPercent: particip,
        enrolledCount,
      });
      const integ = integrityByAssessment.get(a.id) ?? 0;
      return [
        a.title,
        a.kind,
        a.published ? "yes" : "no",
        deliveryModeShortLabel(a.deliveryMode),
        String(a.questions.length),
        usesPools ? "yes" : "no",
        String(summary.attemptCount),
        String(summary.scoredAttemptCount),
        String(summary.distinctStudents),
        String(enrolledCount),
        particip == null ? "" : particip.toFixed(2),
        summary.median == null ? "" : summary.median.toFixed(2),
        summary.mean == null ? "" : summary.mean.toFixed(2),
        health.lowMean ? "yes" : "no",
        health.lowReach ? "yes" : "no",
        summary.min == null ? "" : summary.min.toFixed(2),
        summary.max == null ? "" : summary.max.toFixed(2),
        String(integ),
      ]
        .map((c) => esc(String(c)))
        .join("\t");
    }),
  ];

  const filename = `course-assessments-${courseId.slice(0, 10)}.tsv`;
  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
