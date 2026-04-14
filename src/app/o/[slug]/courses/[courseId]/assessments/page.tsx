import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import {
  assertCourseInOrg,
  assessmentWhereForStudent,
  assessmentVisibleToStudentWhere,
} from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
import { getEnrollment, isStaffRole } from "@/lib/courses/access";
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
import { AssessmentStaffLockToggle } from "@/components/assessments/assessment-staff-lock-toggle";
import { getServerT } from "@/i18n/server";

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
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const course = await assertCourseInOrg(courseId, user.organizationId);
  if (!course) notFound();

  const courseBase = `/o/${slug}/courses/${courseId}`;
  const base = `${courseBase}/assessments`;

  if (isStaffRole(user.role) && (await canTeacherActOnAssessmentCourse(user, courseId))) {
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
          studentAttemptsLocked: true,
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
            <h1 className="page-title">{t("nav.assessments")}</h1>
            <p className="text-muted-foreground">{course.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`${courseBase}/assessment-outcomes`} className={cn(buttonVariants({ variant: "outline" }))}>
              {t("assessments.outcomes")}
            </Link>
            {attentionCount > 0 ? (
              <Link
                href={`${courseBase}/assessment-outcomes?attention=flagged`}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "border-amber-500/40 text-amber-950 dark:text-amber-100",
                )}
              >
                {t("assessments.needsAttentionLink").replace("%s", String(attentionCount))}
              </Link>
            ) : null}
            <Link href={`${base}/new`} className={cn(buttonVariants())}>
              {t("assessments.newAssessment")}
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
            const deptOrClassSuffix = isHe
              ? a._count.assessmentDepartments > 0
                ? ` · ${
                    a._count.assessmentDepartments === 1
                      ? t("assessments.departmentCountOne").replace("%s", String(a._count.assessmentDepartments))
                      : t("assessments.departmentCountMany").replace("%s", String(a._count.assessmentDepartments))
                  }`
                : ` · ${t("assessments.allEnrolled")}`
              : a._count.assessmentCohorts > 0
                ? ` · ${
                    a._count.assessmentCohorts === 1
                      ? t("assessments.classCountOne").replace("%s", String(a._count.assessmentCohorts))
                      : t("assessments.classCountMany").replace("%s", String(a._count.assessmentCohorts))
                  }`
                : ` · ${t("assessments.allEnrolled")}`;
            return (
              <li key={a.id} className="surface-bento flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("assessments.questionsCount").replace("%s", String(a._count.questions))} ·{" "}
                    {t("assessments.submissionsCount").replace("%s", String(a._count.submissions))}
                    {deptOrClassSuffix}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={a.published ? "default" : "secondary"}>
                    {a.published ? t("courses.published") : t("courses.draft")}
                  </Badge>
                  {rowNeedsAttention ? (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-900 dark:text-amber-100">
                      {t("assessments.needsAttentionBadge")}
                    </Badge>
                  ) : null}
                  <Badge variant={deliveryBadgeVariant(a.deliveryMode)}>{deliveryModeBadgeLabel(a.deliveryMode, t)}</Badge>
                  {a.studentAttemptsLocked ? (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-950 dark:text-amber-100">
                      {t("assessments.attemptsLocked")}
                    </Badge>
                  ) : null}
                  <AssessmentStaffLockToggle assessmentId={a.id} initialLocked={a.studentAttemptsLocked} />
                  <Link href={`${base}/${a.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    {t("courses.edit")}
                  </Link>
                  <Link href={`${base}/${a.id}/gradebook`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                    {t("assessments.gradebook")}
                  </Link>
                  <Link
                    href={`${base}/${a.id}/item-analysis`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    {t("assessments.itemAnalysis")}
                  </Link>
                  <Link
                    href={`${base}/${a.id}/integrity`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    {t("assessments.integrityLog")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
        {assessments.length === 0 ? <p className="text-muted-foreground">{t("assessments.noAssessmentsYetStaff")}</p> : null}
        <Link href={`/o/${slug}/courses/${courseId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          {t("assessments.backToCourse")}
        </Link>
      </div>
    );
  }

  const enrolled = await getEnrollment(user.id, courseId);
  if (!enrolled) {
    return (
      <p className="text-muted-foreground">
        {t("assessments.enrollToSeePrompt")}{" "}
        <Link href={`/o/${slug}/courses/${courseId}`} className="text-primary underline">
          {t("assessments.coursePage")}
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
    select: {
      id: true,
      title: true,
      deliveryMode: true,
      studentAttemptsLocked: true,
      _count: { select: { questions: true } },
    },
  });

  const assessmentIds = assessments.map((x) => x.id);
  const draftRows =
    assessmentIds.length > 0
      ? await prisma.submission.findMany({
          where: {
            userId: user.id,
            status: "DRAFT",
            assessmentId: { in: assessmentIds },
          },
          select: { assessmentId: true },
        })
      : [];
  const draftSet = new Set(draftRows.map((r) => r.assessmentId));

  return (
    <div className="space-y-6">
      <h1 className="page-title">{t("nav.assessments")}</h1>
      <p className="text-muted-foreground">{course.title}</p>
      <ul className="space-y-3">
        {assessments.map((a) => {
          const integrityNote = deliveryModeStudentNote(a.deliveryMode, t);
          const hasDraft = draftSet.has(a.id);
          const blocked = a.studentAttemptsLocked && !hasDraft;
          return (
          <li key={a.id} className="surface-bento flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{a.title}</p>
              <p className="text-sm text-muted-foreground">
                {t("assessments.questionsCount").replace("%s", String(a._count.questions))}
              </p>
              {integrityNote ? (
                <p className="mt-1 text-xs text-muted-foreground">{integrityNote}</p>
              ) : null}
              {blocked ? (
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/90">{t("assessments.instructorPausedHint")}</p>
              ) : null}
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
              {a.deliveryMode !== "FORMATIVE" ? (
                <Badge variant={deliveryBadgeVariant(a.deliveryMode)}>{deliveryModeBadgeLabel(a.deliveryMode, t)}</Badge>
              ) : null}
              {blocked ? (
                <span className={cn(buttonVariants({ variant: "secondary" }), "cursor-not-allowed opacity-80")}>
                  {t("assessments.closedLabel")}
                </span>
              ) : (
                <Link href={`${base}/${a.id}/take`} className={cn(buttonVariants())}>
                  {a.studentAttemptsLocked && hasDraft ? t("assessments.resume") : t("assessments.start")}
                </Link>
              )}
            </div>
          </li>
          );
        })}
      </ul>
      {assessments.length === 0 ? <p className="text-muted-foreground">{t("assessments.noPublishedAssessments")}</p> : null}
      <Link href={`/o/${slug}/courses/${courseId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        {t("assessments.backToCourse")}
      </Link>
    </div>
  );
}
