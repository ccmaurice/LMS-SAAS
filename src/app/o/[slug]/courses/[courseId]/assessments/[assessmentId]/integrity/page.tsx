import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
import { isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { deliveryModeShortLabel } from "@/lib/assessments/delivery-mode";
import {
  buildProctoringWhere,
  formatIntegrityPayloadForDisplay,
  INTEGRITY_PAGE_SIZE,
  integrityListSearchParams,
  parseIntegrityListFilters,
} from "@/lib/assessments/integrity-query";
import { proctorEventTypeLabel } from "@/lib/assessments/proctoring-summary";
import { IntegrityLogFilters } from "@/components/assessments/integrity-log-filters";
import { ProctoringExcuseEventButton } from "@/components/assessments/proctoring-excuse-button";
import { getServerT } from "@/i18n/server";

export default async function AssessmentIntegrityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; courseId: string; assessmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, courseId, assessmentId } = await params;
  const sp = await searchParams;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) redirect(`/o/${slug}/courses/${courseId}/assessments`);

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment || assessment.courseId !== courseId) notFound();
  if (!(await canTeacherActOnAssessmentCourse(user, courseId))) {
    redirect(`/o/${slug}/courses/${courseId}/assessments`);
  }

  const filters = parseIntegrityListFilters(sp);
  const where = buildProctoringWhere(assessmentId, {
    student: filters.student,
    eventType: filters.eventType,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    hideExcused: filters.hideExcused,
  });

  const totalCount = await prisma.proctoringEvent.count({ where });
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / INTEGRITY_PAGE_SIZE);

  if (filters.page > totalPages) {
    redirect(
      `${`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/integrity`}?${integrityListSearchParams({
        ...filters,
        page: 1,
      }).toString()}`,
    );
  }

  const skip = (filters.page - 1) * INTEGRITY_PAGE_SIZE;
  const events = await prisma.proctoringEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: INTEGRITY_PAGE_SIZE,
    include: {
      user: { select: { name: true, email: true } },
      dismissedBy: { select: { name: true, email: true } },
    },
  });

  const base = `/o/${slug}/courses/${courseId}/assessments`;
  const integrityPath = `${base}/${assessmentId}/integrity`;
  const exportApiPath = `/api/assessments/${assessmentId}/integrity-export`;

  const prevHref =
    filters.page > 1
      ? `${integrityPath}?${integrityListSearchParams({ ...filters, page: filters.page - 1 }).toString()}`
      : null;
  const nextHref =
    filters.page < totalPages
      ? `${integrityPath}?${integrityListSearchParams({ ...filters, page: filters.page + 1 }).toString()}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{t("assessments.integrityLog")}</h1>
          <p className="mt-1 text-muted-foreground">{assessment.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("assessments.deliveryModeLabel")}{" "}
            <span className="text-foreground">{deliveryModeShortLabel(assessment.deliveryMode, t)}</span>
            {assessment.deliveryMode === "FORMATIVE" ? (
              <span className="block text-xs">{t("assessments.formativeIntegrityNote")}</span>
            ) : null}
          </p>
          <p className="mt-2 max-w-xl text-xs text-muted-foreground">{t("assessments.excusedAuditNote")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/${assessmentId}/gradebook`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {t("assessments.gradebook")}
          </Link>
          <Link href={`${base}/${assessmentId}/item-analysis`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {t("assessments.itemAnalysis")}
          </Link>
          <Link href={`${base}/${assessmentId}/edit`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            {t("courses.edit")}
          </Link>
        </div>
      </div>

      <IntegrityLogFilters
        integrityPath={integrityPath}
        exportApiPath={exportApiPath}
        initialStudent={filters.student}
        initialEventType={filters.eventType}
        initialFrom={filters.fromDate}
        initialTo={filters.toDate}
        initialHideExcused={filters.hideExcused}
        currentPage={filters.page}
        totalCount={totalCount}
      />

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left dark:border-white/10">
              <th className="px-3 py-2 font-medium">{t("assessments.integrityColTime")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.integrityColStudent")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.integrityColSubmission")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.integrityColEvent")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.integrityColPayload")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.integrityColStatus")}</th>
              <th className="px-3 py-2 font-medium">{t("assessments.integrityColExcused")}</th>
              <th className="px-3 py-2 font-medium text-right">{t("assessments.integrityColActions")}</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {t("assessments.integrityNoEvents")}
                </td>
              </tr>
            ) : (
              events.map((e) => {
                const excused = e.dismissedAt != null;
                return (
                  <tr
                    key={e.id}
                    className={cn(
                      "border-b border-border/80 dark:border-white/10",
                      excused && "bg-muted/20 text-muted-foreground",
                    )}
                  >
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                      {e.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground">{e.user?.name ?? "—"}</span>
                      <br />
                      <span className="text-xs text-muted-foreground">{e.user?.email ?? "—"}</span>
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                      {e.submissionId ?? "—"}
                    </td>
                    <td className="px-3 py-2">{proctorEventTypeLabel(e.eventType, t)}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                      {formatIntegrityPayloadForDisplay(e.payload)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {excused ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                          {t("assessments.statusExcused")}
                        </span>
                      ) : (
                        <span className="text-xs">{t("assessments.statusActive")}</span>
                      )}
                    </td>
                    <td className="max-w-[200px] px-3 py-2 text-xs">
                      {excused ? (
                        <>
                          <div className="text-muted-foreground">
                            {e.dismissedAt?.toISOString().replace("T", " ").slice(0, 16)} UTC
                          </div>
                          <div>{e.dismissedBy?.name ?? e.dismissedBy?.email ?? "—"}</div>
                          {e.dismissNote ? (
                            <div className="mt-1 line-clamp-2 text-muted-foreground">{e.dismissNote}</div>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <ProctoringExcuseEventButton
                        assessmentId={assessmentId}
                        eventId={e.id}
                        disabled={excused}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {prevHref ? (
          <Link href={prevHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {t("assessments.integrityPrevPage")}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{t("assessments.integrityPrevPage")}</span>
        )}
        {nextHref ? (
          <Link href={nextHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {t("assessments.integrityNextPage")}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{t("assessments.integrityNextPage")}</span>
        )}
      </div>

      <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        {t("assessments.navAllAssessments")}
      </Link>
    </div>
  );
}
