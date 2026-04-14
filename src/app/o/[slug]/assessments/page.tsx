import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import type { EducationLevel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assessmentWhereForStudent } from "@/lib/assessments/access";
import { courseWhereTeacherAssessmentAccess } from "@/lib/assessments/staff-access";
import { isStaffRole } from "@/lib/courses/access";
import { getStudentCohortIds } from "@/lib/school/cohort-access";
import { getStudentDepartmentIds } from "@/lib/school/department-access";
import { AssessmentsStaffList, AssessmentsStudentList } from "@/components/assessments/assessments-index";
import { AssessmentsStaffFilters } from "@/components/assessments/assessments-staff-filters";
import { AssessmentsStaffToolbar } from "@/components/assessments/assessments-staff-toolbar";
import { getServerT } from "@/i18n/server";

export default async function OrgAssessmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cohort?: string; year?: string; dept?: string }>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const orgRow = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { educationLevel: true, academicYearLabel: true },
  });
  const educationLevel: EducationLevel = orgRow?.educationLevel ?? "SECONDARY";

  if (user.role === "PARENT") {
    const links = await prisma.parentStudentLink.findMany({
      where: { parentUserId: user.id, organizationId: user.organizationId },
      select: { studentUserId: true },
    });
    const ids = links.map((l) => l.studentUserId);
    const childBranches: Prisma.AssessmentWhereInput[] = await Promise.all(
      ids.map(async (childId) => {
        const cohortIds = await getStudentCohortIds(childId, user.organizationId);
        const deptIds = await getStudentDepartmentIds(childId, user.organizationId);
        return {
          AND: [
            { course: { enrollments: { some: { userId: childId } } } },
            assessmentWhereForStudent(educationLevel, cohortIds, deptIds) as Prisma.AssessmentWhereInput,
          ],
        };
      }),
    );

    const assessments =
      ids.length === 0 || childBranches.length === 0
        ? []
        : await prisma.assessment.findMany({
            where: {
              published: true,
              course: { organizationId: user.organizationId },
              OR: childBranches,
            },
            orderBy: { title: "asc" },
            include: { course: { select: { id: true, title: true } } },
          });

    const rows = await Promise.all(
      assessments.map(async (a) => {
        const sub = await prisma.submission.findFirst({
          where: {
            assessmentId: a.id,
            userId: { in: ids },
            submittedAt: { not: null },
            status: { in: ["SUBMITTED", "GRADED"] },
          },
          orderBy: { submittedAt: "desc" },
          select: { id: true },
        });
        return {
          id: a.id,
          title: a.title,
          course: a.course,
          latestSubmissionId: sub?.id ?? null,
        };
      }),
    );

    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">{t("nav.assessments")}</h1>
          <p className="text-muted-foreground">
            {educationLevel === "HIGHER_ED" ? t("assessments.parentIntroHe") : t("assessments.parentIntroK12")}
          </p>
        </div>
        <AssessmentsStudentList slug={slug} rows={rows} viewer="parent" />
        {rows.length === 0 ? <p className="text-muted-foreground">{t("assessments.parentEmpty")}</p> : null}
      </div>
    );
  }

  if (isStaffRole(user.role)) {
    const filterCohort = typeof q.cohort === "string" && q.cohort.length > 0 ? q.cohort : null;
    const filterYear = typeof q.year === "string" && q.year.length > 0 ? q.year : null;
    const filterDept = typeof q.dept === "string" && q.dept.length > 0 ? q.dept : null;

    const where: Prisma.AssessmentWhereInput = {
      course:
        user.role === "TEACHER"
          ? courseWhereTeacherAssessmentAccess(user.organizationId, user.id)
          : { organizationId: user.organizationId },
    };
    const andFilters: Prisma.AssessmentWhereInput[] = [];

    if (educationLevel === "HIGHER_ED") {
      if (filterDept) {
        andFilters.push({
          OR: [
            { course: { courseDepartments: { some: { departmentId: filterDept } } } },
            { assessmentDepartments: { some: { departmentId: filterDept } } },
          ],
        });
      }
    } else {
      if (filterCohort) {
        andFilters.push({
          OR: [
            { course: { courseCohorts: { some: { cohortId: filterCohort } } } },
            { assessmentCohorts: { some: { cohortId: filterCohort } } },
          ],
        });
      }
      if (filterYear) {
        andFilters.push({
          OR: [
            {
              course: {
                courseCohorts: { some: { cohort: { academicYearLabel: filterYear } } },
              },
            },
            {
              assessmentCohorts: { some: { cohort: { academicYearLabel: filterYear } } },
            },
          ],
        });
      }
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const [rows, cohorts, departments, org, manageableCourses] = await Promise.all([
      prisma.assessment.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: { course: { select: { id: true, title: true } } },
      }),
      prisma.schoolCohort.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, academicYearLabel: true },
      }),
      prisma.academicDepartment.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      }),
      prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { academicYearLabel: true },
      }),
      user.role === "ADMIN"
        ? prisma.course.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { title: "asc" },
            select: { id: true, title: true },
          })
        : prisma.course.findMany({
            where: courseWhereTeacherAssessmentAccess(user.organizationId, user.id),
            orderBy: { title: "asc" },
            select: { id: true, title: true },
          }),
    ]);

    const yearSet = new Set<string>();
    for (const c of cohorts) {
      if (c.academicYearLabel?.trim()) yearSet.add(c.academicYearLabel.trim());
    }
    if (org?.academicYearLabel?.trim()) yearSet.add(org.academicYearLabel.trim());

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="page-title">{t("assessments.pageStaffTitle")}</h1>
            <p className="text-muted-foreground">
              {user.role === "TEACHER"
                ? t("assessments.staffIntroTeacher")
                : educationLevel === "HIGHER_ED"
                  ? t("assessments.staffIntroAdminHe")
                  : t("assessments.staffIntroAdminK12")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("assessments.staffOutcomesNote")}</p>
          </div>
          <AssessmentsStaffToolbar
            slug={slug}
            courses={manageableCourses}
            role={user.role === "ADMIN" ? "ADMIN" : "TEACHER"}
          />
        </div>
        <Suspense fallback={<div className="h-14 rounded-xl bg-muted/30" />}>
          <AssessmentsStaffFilters
            slug={slug}
            educationLevel={educationLevel}
            cohorts={cohorts}
            years={[...yearSet]}
            departments={departments}
          />
        </Suspense>
        <AssessmentsStaffList
          slug={slug}
          rows={rows.map((a) => ({
            id: a.id,
            title: a.title,
            course: a.course,
            studentAttemptsLocked: a.studentAttemptsLocked,
          }))}
        />
        {rows.length === 0 ? <p className="text-muted-foreground">{t("assessments.noMatchFilters")}</p> : null}
      </div>
    );
  }

  const cohortIds = await getStudentCohortIds(user.id, user.organizationId);
  const deptIds = await getStudentDepartmentIds(user.id, user.organizationId);
  const assessments = await prisma.assessment.findMany({
    where: {
      published: true,
      course: {
        organizationId: user.organizationId,
        enrollments: { some: { userId: user.id } },
      },
      ...assessmentWhereForStudent(educationLevel, cohortIds, deptIds),
    },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      studentAttemptsLocked: true,
      course: { select: { id: true, title: true } },
    },
  });
  const ids = assessments.map((a) => a.id);
  const draftRows =
    ids.length > 0
      ? await prisma.submission.findMany({
          where: { userId: user.id, status: "DRAFT", assessmentId: { in: ids } },
          select: { assessmentId: true },
        })
      : [];
  const draftSet = new Set(draftRows.map((r) => r.assessmentId));
  const rows = assessments.map((a) => ({
    id: a.id,
    title: a.title,
    course: a.course,
    studentAttemptsLocked: a.studentAttemptsLocked,
    hasDraft: draftSet.has(a.id),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("nav.assessments")}</h1>
        <p className="text-muted-foreground">
          {educationLevel === "HIGHER_ED" ? t("assessments.studentIntroHe") : t("assessments.studentIntroK12")}
        </p>
      </div>
      <AssessmentsStudentList slug={slug} rows={rows} />
      {rows.length === 0 ? <p className="text-muted-foreground">{t("assessments.studentEmpty")}</p> : null}
    </div>
  );
}
