import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCourseInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
import { isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { deliveryModeShortLabel } from "@/lib/assessments/delivery-mode";
import {
  outcomesListSearchParams,
  parseOutcomesListFilters,
  submitParticipationPercent,
  summarizeOutcomeSubmissions,
  type OutcomesListFilters,
} from "@/lib/assessments/course-assessment-outcomes";
import {
  assessmentOutcomeHealth,
  assessmentOutcomeNeedsAttention,
} from "@/lib/assessments/assessment-outcome-health";
import { Badge } from "@/components/ui/badge";

function kindLabel(kind: "QUIZ" | "EXAM"): string {
  return kind === "QUIZ" ? "Quiz" : "Exam";
}

function filterChip(label: string, path: string, active: boolean) {
  return (
    <Link
      href={path}
      className={cn(
        buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
        "rounded-full",
      )}
    >
      {label}
    </Link>
  );
}

function mergeFilters(partial: Partial<OutcomesListFilters>, cur: OutcomesListFilters): OutcomesListFilters {
  return {
    show: partial.show ?? cur.show,
    kind: partial.kind ?? cur.kind,
    attention: partial.attention ?? cur.attention,
  };
}

export default async function CourseAssessmentOutcomesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; courseId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, courseId } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) redirect(`/o/${slug}/courses/${courseId}`);

  const course = await assertCourseInOrg(courseId, user.organizationId);
  if (!course) notFound();
  if (!(await canTeacherActOnAssessmentCourse(user, courseId))) {
    redirect(`/o/${slug}/courses/${courseId}`);
  }

  const filters = parseOutcomesListFilters(sp);
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
        select: {
          _count: { select: { entries: true } },
        },
      },
    },
  });

  const ids = assessments.map((a) => a.id);
  const integrityGroups =
    ids.length > 0
      ? await prisma.proctoringEvent.groupBy({
          by: ["assessmentId"],
          where: { assessmentId: { in: ids }, dismissedAt: null },
          _count: { id: true },
        })
      : [];
  const integrityByAssessment = new Map(integrityGroups.map((g) => [g.assessmentId, g._count.id]));

  const tableRows =
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

  const base = `/o/${slug}/courses/${courseId}`;
  const assessBase = `${base}/assessments`;
  const outcomesPath = `${base}/assessment-outcomes`;

  const qs = (f: OutcomesListFilters) => `${outcomesPath}?${outcomesListSearchParams(f).toString()}`;
  const exportQs = outcomesListSearchParams(filters).toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Assessment outcomes</h1>
          <p className="text-muted-foreground">{course.title}</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Score % uses (total ÷ max) × 100 per <span className="text-foreground">submitted</span> attempt with a
            positive max (<span className="text-foreground">Scored</span> attempts); raw attempt counts include all
            submitted rows.
            <span className="text-foreground"> Particip. %</span> is distinct students with at least one submission ÷
            course enrollments ({enrolledCount} enrolled). <span className="text-foreground">Flags</span> highlight
            published assessments with unusually low mean (≥5 scored attempts) or low participation (≥8 enrolled).
            Use <span className="text-foreground">Needs attention</span> to narrow to those rows. Integrity counts are
            all logged events for the assessment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/api/courses/${courseId}/assessment-outcomes-export${exportQs ? `?${exportQs}` : ""}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Download TSV
          </Link>
          <Link href={assessBase} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            All assessments
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3 dark:border-white/10">
        <p className="text-xs font-medium text-muted-foreground">Filters</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Visibility:</span>
          {filterChip(
            "All",
            qs(mergeFilters({ show: "all" }, filters)),
            filters.show === "all",
          )}
          {filterChip(
            "Published only",
            qs(mergeFilters({ show: "published" }, filters)),
            filters.show === "published",
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Kind:</span>
          {filterChip("All kinds", qs(mergeFilters({ kind: "all" }, filters)), filters.kind === "all")}
          {filterChip("Quizzes", qs(mergeFilters({ kind: "QUIZ" }, filters)), filters.kind === "QUIZ")}
          {filterChip("Exams", qs(mergeFilters({ kind: "EXAM" }, filters)), filters.kind === "EXAM")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Attention:</span>
          {filterChip(
            "All",
            qs(mergeFilters({ attention: "all" }, filters)),
            filters.attention === "all",
          )}
          {filterChip(
            "Needs attention",
            qs(mergeFilters({ attention: "flagged" }, filters)),
            filters.attention === "flagged",
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left dark:border-white/10">
              <th className="px-3 py-2 font-medium">Assessment</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Delivery</th>
              <th className="px-3 py-2 font-medium">Q</th>
              <th className="px-3 py-2 font-medium">Pools</th>
              <th className="px-3 py-2 font-medium">Attempts</th>
              <th className="px-3 py-2 font-medium">Scored</th>
              <th className="px-3 py-2 font-medium">Students</th>
              <th className="px-3 py-2 font-medium">Particip.</th>
              <th className="px-3 py-2 font-medium">Median %</th>
              <th className="px-3 py-2 font-medium">Mean %</th>
              <th className="px-3 py-2 font-medium">Flags</th>
              <th className="px-3 py-2 font-medium">Range</th>
              <th className="px-3 py-2 font-medium">Integrity</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assessments.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-3 py-8 text-center text-muted-foreground">
                  No assessments match these filters.
                </td>
              </tr>
            ) : tableRows.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-3 py-8 text-center text-muted-foreground">
                  No assessments need attention with the current visibility and kind filters.
                </td>
              </tr>
            ) : (
              tableRows.map((a) => {
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
                const range =
                  summary.min != null && summary.max != null
                    ? `${summary.min.toFixed(0)}–${summary.max.toFixed(0)}`
                    : "—";
                return (
                  <tr key={a.id} className="border-b border-border/80 dark:border-white/10">
                    <td className="px-3 py-2 font-medium">{a.title}</td>
                    <td className="whitespace-nowrap px-3 py-2">{kindLabel(a.kind)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={a.published ? "default" : "secondary"}>
                        {a.published ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {deliveryModeShortLabel(a.deliveryMode)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{a.questions.length}</td>
                    <td className="px-3 py-2">{usesPools ? "Yes" : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{summary.attemptCount}</td>
                    <td className="px-3 py-2 tabular-nums">{summary.scoredAttemptCount}</td>
                    <td className="px-3 py-2 tabular-nums">{summary.distinctStudents}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {particip == null ? "—" : `${particip.toFixed(0)}%`}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {summary.median == null ? "—" : `${summary.median.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {summary.mean == null ? "—" : `${summary.mean.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {health.lowMean ? (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-900 dark:text-amber-100">
                            Low mean
                          </Badge>
                        ) : null}
                        {health.lowReach ? (
                          <Badge variant="outline" className="border-sky-500/50 text-sky-950 dark:text-sky-100">
                            Low reach
                          </Badge>
                        ) : null}
                        {!health.lowMean && !health.lowReach ? (
                          <span className="text-muted-foreground">—</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{range}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {integ > 0 ? (
                        <Link
                          href={`${assessBase}/${a.id}/integrity`}
                          className="text-primary underline underline-offset-2"
                        >
                          {integ}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Link
                          href={`${assessBase}/${a.id}/item-analysis`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Items
                        </Link>
                        <Link
                          href={`${assessBase}/${a.id}/gradebook`}
                          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                        >
                          Gradebook
                        </Link>
                        {a.deliveryMode !== "FORMATIVE" ? (
                          <Link
                            href={`${assessBase}/${a.id}/integrity`}
                            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                          >
                            Log
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        ← Course
      </Link>
    </div>
  );
}
