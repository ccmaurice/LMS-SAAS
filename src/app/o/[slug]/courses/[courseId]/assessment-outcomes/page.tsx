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
import { getServerT } from "@/i18n/server";

function kindLabel(kind: "QUIZ" | "EXAM", t: (key: string) => string): string {
  return kind === "QUIZ" ? t("assessments.kindQuiz") : t("assessments.kindExam");
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
  const t = await getServerT();
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
          <h1 className="page-title">{t("assessments.outcomesPageTitle")}</h1>
          <p className="text-muted-foreground">{course.title}</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("assessments.outcomesExplainer").replace("%s", String(enrolledCount))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/api/courses/${courseId}/assessment-outcomes-export${exportQs ? `?${exportQs}` : ""}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {t("assessments.downloadTsv")}
          </Link>
          <Link href={assessBase} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {t("assessments.allAssessmentsLink")}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3 dark:border-white/10">
        <p className="text-xs font-medium text-muted-foreground">{t("assessments.filtersSection")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("assessments.visibilityLabel")}</span>
          {filterChip(
            t("assessments.filterChipAll"),
            qs(mergeFilters({ show: "all" }, filters)),
            filters.show === "all",
          )}
          {filterChip(
            t("assessments.filterPublishedOnly"),
            qs(mergeFilters({ show: "published" }, filters)),
            filters.show === "published",
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("assessments.kindLabelShort")}</span>
          {filterChip(
            t("assessments.filterAllKinds"),
            qs(mergeFilters({ kind: "all" }, filters)),
            filters.kind === "all",
          )}
          {filterChip(
            t("assessments.filterQuizzes"),
            qs(mergeFilters({ kind: "QUIZ" }, filters)),
            filters.kind === "QUIZ",
          )}
          {filterChip(
            t("assessments.filterExams"),
            qs(mergeFilters({ kind: "EXAM" }, filters)),
            filters.kind === "EXAM",
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("assessments.attentionLabel")}</span>
          {filterChip(
            t("assessments.filterChipAll"),
            qs(mergeFilters({ attention: "all" }, filters)),
            filters.attention === "all",
          )}
          {filterChip(
            t("assessments.filterNeedsAttention"),
            qs(mergeFilters({ attention: "flagged" }, filters)),
            filters.attention === "flagged",
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left dark:border-white/10">
              <th className="px-3 py-2 font-medium">{t("assessments.colAssessment")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colKind")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colStatus")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colDelivery")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colQ")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colPools")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colAttempts")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colScored")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colStudents")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colParticip")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colMedianPercent")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colMeanPercent")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colFlags")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colRange")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colIntegrity")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {assessments.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-3 py-8 text-center text-muted-foreground">
                  {t("assessments.emptyOutcomesNoMatch")}
                </td>
              </tr>
            ) : tableRows.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-3 py-8 text-center text-muted-foreground">
                  {t("assessments.emptyOutcomesNoAttention")}
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
                    <td className="whitespace-nowrap px-3 py-2">{kindLabel(a.kind, t)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={a.published ? "default" : "secondary"}>
                        {a.published ? t("assessments.statusPublished") : t("assessments.statusDraft")}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {deliveryModeShortLabel(a.deliveryMode, t)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{a.questions.length}</td>
                    <td className="px-3 py-2">{usesPools ? t("assessments.yesShort") : "—"}</td>
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
                            {t("assessments.flagLowMean")}
                          </Badge>
                        ) : null}
                        {health.lowReach ? (
                          <Badge variant="outline" className="border-sky-500/50 text-sky-950 dark:text-sky-100">
                            {t("assessments.flagLowReach")}
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
                          {t("assessments.itemsShort")}
                        </Link>
                        <Link
                          href={`${assessBase}/${a.id}/gradebook`}
                          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                        >
                          {t("assessments.gradebook")}
                        </Link>
                        {a.deliveryMode !== "FORMATIVE" ? (
                          <Link
                            href={`${assessBase}/${a.id}/integrity`}
                            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                          >
                            {t("assessments.logShort")}
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
        {t("assessments.outcomesBackToCourse")}
      </Link>
    </div>
  );
}
