import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";
import { AssessmentEditor } from "@/components/assessments/assessment-editor";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string; assessmentId: string }>;
}) {
  const { slug, courseId, assessmentId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) redirect(`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/take`);

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment || assessment.courseId !== courseId) notFound();
  if (!canTeacherManageCourse(user, assessment.course.createdById)) {
    redirect(`/o/${slug}/courses/${courseId}/assessments`);
  }

  const level = assessment.course.organization.educationLevel;

  const [questions, courseCohortRows, courseDeptRows] = await Promise.all([
    prisma.question.findMany({
      where: { assessmentId },
      orderBy: { order: "asc" },
    }),
    level === "HIGHER_ED"
      ? Promise.resolve([])
      : prisma.courseCohort.findMany({
          where: { courseId },
          include: {
            cohort: { select: { id: true, name: true, gradeLabel: true, academicYearLabel: true } },
          },
          orderBy: { cohort: { name: "asc" } },
        }),
    level === "HIGHER_ED"
      ? prisma.courseDepartment.findMany({
          where: { courseId },
          include: {
            department: {
              include: { facultyDivision: { select: { name: true } } },
            },
          },
          orderBy: { department: { name: "asc" } },
        })
      : Promise.resolve([]),
  ]);

  const linkedCourseCohorts = courseCohortRows.map((r) => r.cohort);
  const initialCohortIds = assessment.assessmentCohorts.map((x) => x.cohortId);
  const linkedCourseDepartments = courseDeptRows.map((r) => ({
    id: r.department.id,
    name: r.department.name,
    code: r.department.code,
    facultyDivisionName: r.department.facultyDivision?.name ?? null,
  }));
  const initialDepartmentIds = assessment.assessmentDepartments.map((x) => x.departmentId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/take`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Student preview (blocked for staff — copy link for student)
        </Link>
      </div>
      <AssessmentEditor
        orgSlug={slug}
        courseId={courseId}
        educationLevel={level}
        initialAssessment={{
          id: assessment.id,
          title: assessment.title,
          description: assessment.description,
          kind: assessment.kind,
          semester: assessment.semester,
          timeLimitMinutes: assessment.timeLimitMinutes,
          published: assessment.published,
          shuffleQuestions: assessment.shuffleQuestions,
          shuffleOptions: assessment.shuffleOptions,
        }}
        initialQuestions={questions}
        linkedCourseCohorts={linkedCourseCohorts}
        initialCohortIds={initialCohortIds}
        linkedCourseDepartments={linkedCourseDepartments}
        initialDepartmentIds={initialDepartmentIds}
      />
    </div>
  );
}
