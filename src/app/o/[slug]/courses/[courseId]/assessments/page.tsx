import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import {
  assertCourseInOrg,
  assessmentWhereForStudent,
  assessmentVisibleToStudentWhere,
} from "@/lib/assessments/access";
import { canTeacherManageCourse, getEnrollment, isStaffRole } from "@/lib/courses/access";
import { getStudentCohortIds } from "@/lib/school/cohort-access";
import { getStudentDepartmentIds } from "@/lib/school/department-access";
import type { AssessmentDeliveryMode, EducationLevel } from "@/generated/prisma/enums";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  deliveryModeBadgeLabel,
  deliveryModeStudentNote,
} from "@/lib/assessments/delivery-mode";
import { assessmentOutcomeNeedsAttention } from "@/lib/assessments/assessment-outcome-health";
import { submitParticipationPercent, summarizeOutcomeSubmissions } from "@/lib/assessments/course-assessment-outcomes";

function deliveryBadgeVariant(
  mode: AssessmentDeliveryMode,
): "secondary" | "outline" | "destructive" {
  if (mode === "LOCKDOWN") return "destructive";
  if (mode === "SECURE_ONLINE") return "secondary";
  return "outline";
}

export default async function CourseAssessmentsPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const course = await assertCourseInOrg(courseId, user.organizationId);
  if (!course) notFound();

  const courseBase = `/o/${slug}/courses/${courseId}`;
  const base = `${courseBase}/assessments`;

  if (isStaffRole(user.role) && canTeacherManageCourse(user, course.createdById)) {
    const orgLevel = (await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { educationLevel: true },
    }))?.educationLevel as EducationLevel | undefined;

    const [enrolledCount, assessments] = await Promise.all([
      prisma.enrollment.count({ where: { courseId } }),
      prisma.assessment.findMany({
        where: { courseId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          published: true,
          deliveryMode: true,
          submissions: {
            where: { status: "SUBMITTED" },
            select: { totalScore: true, maxScore: true, userId: true },
          },
          _count: {
            select: { questions: true, submissions: true, assessmentCohorts: true, assessmentDepartments: true },
          },
        },
      }),
    ]);

    const attentionCount = assessments.filter((a) => {
      if (!a.published) return false;
      const s = summarizeOutcomeSubmissions(a.submissions);
      const p = submitParticipationPercent(s.distinctStudents, enrolledCount);
      return assessmentOutcomeNeedsAttention({
        published: true,
        mean: s.mean,
        scoredAttemptCount: s.scoredAttemptCount,
        participationPercent: p,
        enrolledCount,
      });
    }).length;

    const isHe = orgLevel === "HIGHER_ED";

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="page-title">Assessments</h1>
            <p className="text-muted-foreground">{course.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`${courseBase}/assessment-outcomes`} className={cn(buttonVariants({ variant: "outline" }))}>
              Outcomes
            </Link>
            {attentionCount > 0 ? (
              <Link
                href={`${courseBase}/assessment-outcomes?attention=flagged`}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "border-amber-500/40 text-amber-950 dark:text-amber-100",
                )}
              >
                Needs attention ({attentionCount})
              </Link>
            ) : null}
            <Link href={`${base}/new`} className={cn(buttonVariants())}>
              New assessment
            </Link>
          </div>
        </div>
        <ul className="space-y-3">
          {assessments.map((a) => {
            const rollup = summarizeOutcomeSubmissions(a.submissions);
            const particip = submitParticipationPercent(rollup.distinctStudents, enrolledCount);
            const rowNeedsAttention =
              a.published &&
              assessmentOutcomeNeedsAttention({
                published: true,
                mean: rollup.mean,
                scoredAttemptCount: rollup.scoredAttemptCount,
                participationPercent: particip,
                enrolledCount,
              });
            return (
              <li key={a.id} className="surface-bento flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {a._count.questions} questions · {a._count.submissions} submissions
                    {isHe
                      ? a._count.assessmentDepartments > 0
                        ? ` · ${a._count.assessmentDepartments} department${
                            a._count.assessmentDepartments === 1 ? "" : "s"
                          }`
                        : " · all enrolled"
                      : a._count.assessmentCohorts > 0
                        ? ` · ${a._count.assessmentCohorts} class${a._count.assessmentCohorts === 1 ? "" : "es"}`
                        : " · all enrolled"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={a.published ? "default" : "secondary"}>
                    {a.published ? "Published" : "Draft"}
                  </Badge>
                  {rowNeedsAttention ? (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-900 dark:text-amber-100">
                      Needs attention
                    </Badge>
                  ) : null}
                  <Badge variant={deliveryBadgeVariant(a.deliveryMode)}>{deliveryModeBadgeLabel(a.deliveryMode)}</Badge>
                  <Link href={`${base}/${a.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    Edit
                  </Link>
                  <Link href={`${base}/${a.id}/gradebook`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                    Gradebook
                  </Link>
                  <Link
                    href={`${base}/${a.id}/item-analysis`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Item analysis
                  </Link>
                  <Link
                    href={`${base}/${a.id}/integrity`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Integrity log
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
        {assessments.length === 0 ? <p className="text-muted-foreground">No assessments yet.</p> : null}
        <Link href={`/o/${slug}/courses/${courseId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          ← Back to course
        </Link>
      </div>
    );
  }

  const enrolled = await getEnrollment(user.id, courseId);
  if (!enrolled) {
    return (
      <p className="text-muted-foreground">
        Enroll in this course to see assessments.{" "}
        <Link href={`/o/${slug}/courses/${courseId}`} className="text-primary underline">
          Course page
        </Link>
      </p>
    );
  }

  const orgLevel = (await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { educationLevel: true },
  }))?.educationLevel as EducationLevel | undefined;

  const studentCohortIds = await getStudentCohortIds(user.id, user.organizationId);
  const studentDeptIds =
    orgLevel === "HIGHER_ED" ? await getStudentDepartmentIds(user.id, user.organizationId) : [];

  const assessments = await prisma.assessment.findMany({
    where: {
      courseId,
      published: true,
      ...(orgLevel
        ? assessmentWhereForStudent(orgLevel, studentCohortIds, studentDeptIds)
        : assessmentVisibleToStudentWhere(studentCohortIds)),
    },
    orderBy: { title: "asc" },
    include: { _count: { select: { questions: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="page-title">Assessments</h1>
      <p className="text-muted-foreground">{course.title}</p>
      <ul className="space-y-3">
        {assessments.map((a) => {
          const integrityNote = deliveryModeStudentNote(a.deliveryMode);
          return (
          <li key={a.id} className="surface-bento flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{a.title}</p>
              <p className="text-sm text-muted-foreground">{a._count.questions} questions</p>
              {integrityNote ? (
                <p className="mt-1 text-xs text-muted-foreground">{integrityNote}</p>
              ) : null}
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
              {a.deliveryMode !== "FORMATIVE" ? (
                <Badge variant={deliveryBadgeVariant(a.deliveryMode)}>{deliveryModeBadgeLabel(a.deliveryMode)}</Badge>
              ) : null}
              <Link href={`${base}/${a.id}/take`} className={cn(buttonVariants())}>
                Start
              </Link>
            </div>
          </li>
          );
        })}
      </ul>
      {assessments.length === 0 ? <p className="text-muted-foreground">No published assessments.</p> : null}
      <Link href={`/o/${slug}/courses/${courseId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        ← Back to course
      </Link>
    </div>
  );
}
