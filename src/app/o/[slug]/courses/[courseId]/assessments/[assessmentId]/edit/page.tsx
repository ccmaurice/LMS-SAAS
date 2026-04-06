import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
import { isStaffRole } from "@/lib/courses/access";
import { AssessmentEditor } from "@/components/assessments/assessment-editor";
import type { ScheduleEntryClient } from "@/components/assessments/assessment-schedule-editor";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

function isoToDatetimeLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const t = d.getTime() - d.getTimezoneOffset() * 60_000;
  return new Date(t).toISOString().slice(0, 16);
}

function mapScheduleRowsToClient(
  rows: {
    kind: ScheduleEntryClient["kind"];
    startsAt: Date;
    endsAt: Date | null;
    allDay: boolean;
    label: string | null;
    sortOrder: number;
  }[],
): ScheduleEntryClient[] {
  return rows.map((e) => ({
    kind: e.kind,
    startsAt: e.allDay ? e.startsAt.toISOString().slice(0, 10) : isoToDatetimeLocalInput(e.startsAt.toISOString()),
    endsAt:
      e.kind === "EXAM_WINDOW" && e.endsAt
        ? e.allDay
          ? e.endsAt.toISOString().slice(0, 10)
          : isoToDatetimeLocalInput(e.endsAt.toISOString())
        : "",
    allDay: e.allDay,
    label: e.label ?? "",
    sortOrder: e.sortOrder,
  }));
}

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
  if (!(await canTeacherActOnAssessmentCourse(user, courseId))) {
    redirect(`/o/${slug}/courses/${courseId}/assessments`);
  }

  const level = assessment.course.organization.educationLevel;

  const [questions, courseCohortRows, courseDeptRows, scheduleRows] = await Promise.all([
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
    prisma.assessmentScheduleEntry.findMany({
      where: { assessmentId },
      orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
    }),
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
          studentAttemptsLocked: assessment.studentAttemptsLocked,
          shuffleQuestions: assessment.shuffleQuestions,
          shuffleOptions: assessment.shuffleOptions,
          showAnswersToStudents: assessment.showAnswersToStudents,
          maxAttemptsPerStudent: assessment.maxAttemptsPerStudent,
          retakeRequiresApproval: assessment.retakeRequiresApproval,
          deliveryMode: assessment.deliveryMode,
        }}
        initialScheduleEntries={mapScheduleRowsToClient(scheduleRows)}
        initialQuestions={questions}
        linkedCourseCohorts={linkedCourseCohorts}
        initialCohortIds={initialCohortIds}
        linkedCourseDepartments={linkedCourseDepartments}
        initialDepartmentIds={initialDepartmentIds}
      />
    </div>
  );
}
