import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { DashboardBento } from "@/components/dashboard/dashboard-bento";
import {
  getEligibleCertificates,
  getRecentDiscussionMessages,
  getRecentSchoolMessages,
  getUserReportCardRows,
} from "@/lib/dashboard/insights";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const staff = isStaffRole(user.role);

  const publishedAssessmentsPromise =
    user.role === "STUDENT"
      ? prisma.assessment.count({
          where: {
            published: true,
            course: {
              organizationId: user.organizationId,
              enrollments: { some: { userId: user.id } },
            },
          },
        })
      : prisma.assessment.count({
          where: { published: true, course: { organizationId: user.organizationId } },
        });

  const cmsPromise = prisma.cmsEntry.findMany({
    where: {
      organizationId: user.organizationId,
      key: { in: ["dashboard.welcome", "dashboard.subtitle"] },
    },
    select: { key: true, value: true },
  });

  const insightsPromise = Promise.all([
    getRecentSchoolMessages(user.organizationId, 6),
    getRecentDiscussionMessages({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      take: 6,
    }),
    getUserReportCardRows(user.id, user.organizationId, user.role),
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
      where: { userId: user.id, course: { organizationId: user.organizationId } },
      include: { course: { select: { id: true, title: true, published: true } } },
      orderBy: { enrolledAt: "desc" },
      take: 6,
    }),
    prisma.enrollment.count({
      where: { userId: user.id, course: { organizationId: user.organizationId } },
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
      teachingCount={teachingCount}
      draftCourses={draftCourses}
      staff={staff}
      studentScopedAssessments={user.role === "STUDENT"}
      enrollments={enrollments.map((e) => ({
        id: e.id,
        progressPercent: e.progressPercent,
        course: e.course,
      }))}
      recentSchoolMessages={recentSchoolSerialized}
      recentDiscussions={recentDiscussionsSerialized}
      reportPreview={reportPreview}
      certificates={certificates}
    />
  );
}
