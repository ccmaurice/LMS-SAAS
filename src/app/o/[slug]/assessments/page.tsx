import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { AssessmentsStaffList, AssessmentsStudentList } from "@/components/assessments/assessments-index";

export default async function OrgAssessmentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  if (isStaffRole(user.role)) {
    const rows = await prisma.assessment.findMany({
      where: { course: { organizationId: user.organizationId } },
      orderBy: { updatedAt: "desc" },
      include: { course: { select: { id: true, title: true } } },
    });

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All assessments</h1>
          <p className="text-muted-foreground">Jump to a course to create new quizzes or open the gradebook.</p>
        </div>
        <AssessmentsStaffList slug={slug} rows={rows} />
        {rows.length === 0 ? <p className="text-muted-foreground">No assessments yet.</p> : null}
      </div>
    );
  }

  const rows = await prisma.assessment.findMany({
    where: {
      published: true,
      course: {
        organizationId: user.organizationId,
        enrollments: { some: { userId: user.id } },
      },
    },
    orderBy: { title: "asc" },
    include: { course: { select: { id: true, title: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
        <p className="text-muted-foreground">Published quizzes and exams for courses you are enrolled in.</p>
      </div>
      <AssessmentsStudentList slug={slug} rows={rows} />
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Nothing here yet — enroll in a course with assessments.</p>
      ) : null}
    </div>
  );
}
