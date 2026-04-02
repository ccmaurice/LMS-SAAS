import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { parseSchoolPublicExtraCards, SCHOOL_PUBLIC_EXTRA_CARDS_KEY } from "@/lib/school-public";

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="truncate pr-2 font-medium">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="surface-bento p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default async function AdminAnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (user.role !== "ADMIN") redirect(`/o/${slug}/dashboard`);

  const orgId = user.organizationId;
  // Rolling window for “last 7 days” metrics (async server component; not a client re-render).
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // eslint-disable-line react-hooks/purity -- reporting snapshot

  const [
    usersByRole,
    coursesByPublished,
    enrollmentTotal,
    assessmentCount,
    submissionsWeek,
    completionsWeek,
    pendingInvites,
    topCourses,
    schoolPublicCmsRows,
    extraCardRow,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      where: { organizationId: orgId },
      _count: { _all: true },
    }),
    prisma.course.groupBy({
      by: ["published"],
      where: { organizationId: orgId },
      _count: { _all: true },
    }),
    prisma.enrollment.count({ where: { course: { organizationId: orgId } } }),
    prisma.assessment.count({ where: { course: { organizationId: orgId } } }),
    prisma.submission.count({
      where: {
        submittedAt: { gte: weekAgo },
        assessment: { course: { organizationId: orgId } },
      },
    }),
    prisma.lessonProgress.count({
      where: {
        completedAt: { gte: weekAgo },
        lesson: { module: { course: { organizationId: orgId } } },
      },
    }),
    prisma.userInvite.count({
      where: { organizationId: orgId, expiresAt: { gt: new Date() } },
    }),
    prisma.course.findMany({
      where: { organizationId: orgId },
      orderBy: { enrollments: { _count: "desc" } },
      take: 6,
      select: { id: true, title: true, _count: { select: { enrollments: true } } },
    }),
    prisma.cmsEntry.count({
      where: { organizationId: orgId, key: { startsWith: "school.public." } },
    }),
    prisma.cmsEntry.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: SCHOOL_PUBLIC_EXTRA_CARDS_KEY } },
      select: { value: true },
    }),
  ]);

  const publicExtraSections = parseSchoolPublicExtraCards(extraCardRow?.value).length;

  const roleCounts = Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all])) as Record<string, number>;
  const totalUsers = usersByRole.reduce((s, r) => s + r._count._all, 0);
  const publishedRow = coursesByPublished.find((c) => c.published);
  const draftRow = coursesByPublished.find((c) => !c.published);
  const publishedCourses = publishedRow?._count._all ?? 0;
  const draftCourses = draftRow?._count._all ?? 0;
  const maxEnrolled = Math.max(1, ...topCourses.map((c) => c._count.enrollments));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="mt-1 text-muted-foreground">Snapshot of activity in your organization.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Members" value={totalUsers} hint={`Admins ${roleCounts.ADMIN ?? 0} · Teachers ${roleCounts.TEACHER ?? 0} · Students ${roleCounts.STUDENT ?? 0}`} />
        <Stat label="Enrollments" value={enrollmentTotal} hint="Seat assignments across courses" />
        <Stat label="Courses" value={publishedCourses + draftCourses} hint={`${publishedCourses} published · ${draftCourses} draft`} />
        <Stat label="Assessments" value={assessmentCount} />
      </section>

      <section className="surface-bento p-6">
        <h2 className="text-lg font-semibold tracking-tight">Public marketing page</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {schoolPublicCmsRows} CMS field{schoolPublicCmsRows === 1 ? "" : "s"} under{" "}
          <code className="rounded bg-muted px-1 text-xs">school.public.*</code> · {publicExtraSections} custom section
          {publicExtraSections === 1 ? "" : "s"}. Open{" "}
          <Link href={`/school/${slug}`} className="font-medium text-foreground underline-offset-4 hover:underline">
            /school/{slug}
          </Link>{" "}
          or edit in{" "}
          <Link href={`/o/${slug}/admin/cms`} className="font-medium text-foreground underline-offset-4 hover:underline">
            Admin → CMS
          </Link>
          . The same numbers feed platform tenant analytics for billing and support prioritization.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="surface-bento p-6">
          <h2 className="text-lg font-semibold tracking-tight">Last 7 days</h2>
          <p className="mt-1 text-sm text-muted-foreground">Assessments submitted and lessons marked complete.</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Submissions</dt>
              <dd className="text-xl font-semibold tabular-nums">{submissionsWeek}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Lesson completions</dt>
              <dd className="text-xl font-semibold tabular-nums">{completionsWeek}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Pending invites</dt>
              <dd className="text-xl font-semibold tabular-nums">{pendingInvites}</dd>
            </div>
          </dl>
        </div>

        <div className="surface-bento p-6">
          <h2 className="text-lg font-semibold tracking-tight">Courses by enrollment</h2>
          <p className="mt-1 text-sm text-muted-foreground">Relative bar width uses the largest value in the list.</p>
          <div className="mt-4 space-y-4">
            {topCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courses yet.</p>
            ) : (
              topCourses.map((c) => (
                <BarRow key={c.id} label={c.title} value={c._count.enrollments} max={maxEnrolled} />
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
