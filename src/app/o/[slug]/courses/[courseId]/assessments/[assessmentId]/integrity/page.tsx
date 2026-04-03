import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { deliveryModeShortLabel } from "@/lib/assessments/delivery-mode";
import {
  buildProctoringWhere,
  integrityListSearchParams,
  parseIntegrityListFilters,
} from "@/lib/assessments/integrity-query";
import { proctorEventTypeLabel } from "@/lib/assessments/proctoring-summary";
import {
  INTEGRITY_PAGE_SIZE,
  IntegrityLogFilters,
} from "@/components/assessments/integrity-log-filters";

export default async function AssessmentIntegrityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; courseId: string; assessmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, courseId, assessmentId } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) redirect(`/o/${slug}/courses/${courseId}/assessments`);

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment || assessment.courseId !== courseId) notFound();
  if (!canTeacherManageCourse(user, assessment.course.createdById)) {
    redirect(`/o/${slug}/courses/${courseId}/assessments`);
  }

  const filters = parseIntegrityListFilters(sp);
  const where = buildProctoringWhere(assessmentId, {
    student: filters.student,
    eventType: filters.eventType,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
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
          <h1 className="page-title">Integrity log</h1>
          <p className="mt-1 text-muted-foreground">{assessment.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Delivery mode: <span className="text-foreground">{deliveryModeShortLabel(assessment.deliveryMode)}</span>
            {assessment.deliveryMode === "FORMATIVE" ? (
              <span className="block text-xs">
                No new signals are accepted while the assessment is formative; older rows may remain from a previous
                mode.
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/${assessmentId}/gradebook`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Gradebook
          </Link>
          <Link href={`${base}/${assessmentId}/item-analysis`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Item analysis
          </Link>
          <Link href={`${base}/${assessmentId}/edit`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            Edit
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
        currentPage={filters.page}
        totalCount={totalCount}
      />

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left dark:border-white/10">
              <th className="px-3 py-2 font-medium">Time (UTC)</th>
              <th className="px-3 py-2 font-medium">Student</th>
              <th className="px-3 py-2 font-medium">Submission</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Payload</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No integrity events match these filters.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-b border-border/80 dark:border-white/10">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {e.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{e.user.name ?? "—"}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">{e.user.email}</span>
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                    {e.submissionId ?? "—"}
                  </td>
                  <td className="px-3 py-2">{proctorEventTypeLabel(e.eventType)}</td>
                  <td className="max-w-xs truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                    {e.payload == null ? "—" : JSON.stringify(e.payload)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {prevHref ? (
          <Link href={prevHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Previous page
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">Previous page</span>
        )}
        {nextHref ? (
          <Link href={nextHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Next page
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">Next page</span>
        )}
      </div>

      <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        ← All assessments
      </Link>
    </div>
  );
}
