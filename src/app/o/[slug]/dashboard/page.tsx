import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import {
  countPublishedVisibleAssessmentsForParentDistinct,
  countPublishedVisibleAssessmentsForStudent,
} from "@/lib/assessments/access";
import { isStaffRole } from "@/lib/courses/access";
import { DashboardBento } from "@/components/dashboard/dashboard-bento";
import {
  getEligibleCertificates,
  getRecentDiscussionMessages,
  getRecentSchoolMessages,
  getUserReportCardRows,
} from "@/lib/dashboard/insights";
import { ensureUpcomingCalendarNotifications } from "@/lib/calendar/calendar-notifications";
import {
  defaultDashboardCalendarRange,
  fetchDashboardCalendarItems,
} from "@/lib/calendar/dashboard-calendar";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?org=${encodeURIComponent(slug)}&redirect=${encodeURIComponent(`/o/${slug}/dashboard`)}`);
  }

  const staff = isStaffRole(user.role);

  const parentChildIds =
    user.role === "PARENT"
      ? (
          await prisma.parentStudentLink.findMany({
            where: { parentUserId: user.id, organizationId: user.organizationId },
            select: { studentUserId: true },
          })
        ).map((l) => l.studentUserId)
      : [];

  const publishedAssessmentsPromise =
    user.role === "STUDENT"
      ? countPublishedVisibleAssessmentsForStudent(user.id, user.organizationId)
      : user.role === "PARENT" && parentChildIds.length > 0
        ? countPublishedVisibleAssessmentsForParentDistinct(user.id, user.organizationId)
        : user.role === "PARENT"
          ? Promise.resolve(0)
          : prisma.assessment.count({
              where: { published: true, course: { organizationId: user.organizationId } },
            });

  const assessmentsSubtitleMode =
    user.role === "STUDENT" ? ("student" as const) : user.role === "PARENT" ? ("parent" as const) : undefined;

  const cmsPromise = prisma.cmsEntry.findMany({
    where: {
      organizationId: user.organizationId,
      key: { in: ["dashboard.welcome", "dashboard.subtitle"] },
    },
    select: { key: true, value: true },
  });

  const reportCardSubjectId =
    user.role === "PARENT" ? (parentChildIds[0] ?? null) : user.id;
  const reportRowsPromise =
    user.role === "PARENT"
      ? reportCardSubjectId
        ? getUserReportCardRows(reportCardSubjectId, user.organizationId, "STUDENT")
        : Promise.resolve([])
      : getUserReportCardRows(user.id, user.organizationId, user.role);

  const insightsPromise = Promise.all([
    getRecentSchoolMessages(user.organizationId, 6),
    getRecentDiscussionMessages({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      take: 6,
      linkedStudentUserIds: user.role === "PARENT" ? parentChildIds : undefined,
    }),
    reportRowsPromise,
    getEligibleCertificates(user.id, user.organizationId, user.role),
  ]);

  const [
    enrollments,
    enrollmentTotal,
    teachingCount,
    publishedAssessments,
    draftCourses,
    cmsRows,
    [recentSchoolMessages, recentDiscussions, reportRows, certificates],
  ] = await Promise.all([
    prisma.enrollment.findMany({
      where:
        user.role === "PARENT" && parentChildIds.length > 0
          ? { userId: { in: parentChildIds }, course: { organizationId: user.organizationId } }
          : { userId: user.id, course: { organizationId: user.organizationId } },
      include: { course: { select: { id: true, title: true, published: true } } },
      orderBy: { enrolledAt: "desc" },
      take: 6,
    }),
    prisma.enrollment.count({
      where:
        user.role === "PARENT" && parentChildIds.length > 0
          ? { userId: { in: parentChildIds }, course: { organizationId: user.organizationId } }
          : { userId: user.id, course: { organizationId: user.organizationId } },
    }),
    staff
      ? prisma.course.count({ where: { organizationId: user.organizationId, createdById: user.id } })
      : Promise.resolve(0),
    publishedAssessmentsPromise,
    staff
      ? prisma.course.count({
          where: { organizationId: user.organizationId, createdById: user.id, published: false },
        })
      : Promise.resolve(0),
    cmsPromise,
    insightsPromise,
  ]);

  const cms = Object.fromEntries(cmsRows.map((r) => [r.key, r.value])) as Record<string, string>;

  const { rangeStart: calFrom, rangeEnd: calTo } = defaultDashboardCalendarRange(new Date(), 2);
  try {
    await ensureUpcomingCalendarNotifications({
      userId: user.id,
      organizationId: user.organizationId,
      orgSlug: slug,
      role: user.role,
      parentChildIds,
    });
  } catch {
    /* avoid blocking dashboard if notification insert fails */
  }
  const calendarItems = await fetchDashboardCalendarItems({
    organizationId: user.organizationId,
    orgSlug: slug,
    userId: user.id,
    role: user.role,
    parentChildIds,
    rangeStart: calFrom,
    rangeEnd: calTo,
  });

  const reportPreview = reportRows.slice(0, 5).map((r) => ({
    submissionId: r.submissionId,
    assessmentId: r.assessmentId,
    assessmentTitle: r.assessmentTitle,
    courseId: r.courseId,
    courseTitle: r.courseTitle,
    totalScore: r.totalScore,
    maxScore: r.maxScore,
  }));

  const recentSchoolSerialized = recentSchoolMessages.map((m) => ({
    id: m.id,
    bodyPreview: m.bodyPreview,
    createdAt: m.createdAt.toISOString(),
    authorLabel: m.authorLabel,
    isPlatform: m.isPlatform,
  }));

  const recentDiscussionsSerialized = recentDiscussions.map((m) => ({
    id: m.id,
    bodyPreview: m.bodyPreview,
    createdAt: m.createdAt.toISOString(),
    authorLabel: m.authorLabel,
    courseId: m.courseId,
    courseTitle: m.courseTitle,
  }));

  return (
    <DashboardBento
      slug={slug}
      userEmail={user.email}
      userRole={user.role}
      orgName={user.organization.name}
      cmsWelcome={cms["dashboard.welcome"]}
      cmsSubtitle={cms["dashboard.subtitle"]}
      enrollmentTotal={enrollmentTotal}
      publishedAssessments={publishedAssessments}
      assessmentsSubtitleMode={assessmentsSubtitleMode}
      teachingCount={teachingCount}
      draftCourses={draftCourses}
      staff={staff}
      studentScopedAssessments={user.role === "STUDENT" || user.role === "PARENT"}
      enrollments={enrollments.map((e) => ({
        id: e.id,
        progressPercent: e.progressPercent,
        course: e.course,
      }))}
      recentSchoolMessages={recentSchoolSerialized}
      recentDiscussions={recentDiscussionsSerialized}
      reportPreview={reportPreview}
      certificates={certificates}
      calendarItems={calendarItems}
    />
  );
}
