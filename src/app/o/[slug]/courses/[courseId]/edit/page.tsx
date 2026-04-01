import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";
import { CourseGradingPanel } from "@/components/courses/course-grading-panel";
import { CourseCohortPanel } from "@/components/courses/course-cohort-panel";
import { CourseDepartmentPanel } from "@/components/courses/course-department-panel";
import { CourseEditor, type EditableCourse } from "@/components/courses/course-editor";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }
  if (!isStaffRole(user.role)) {
    redirect(`/o/${slug}/courses/${courseId}`);
  }

  const edu = user.organization.educationLevel;

  const [course, terms, allCohorts, allDepartments] = await Promise.all([
    prisma.course.findFirst({
      where: { id: courseId, organizationId: user.organizationId },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: { orderBy: { order: "asc" }, include: { files: true } },
          },
        },
      },
    }),
    prisma.academicTerm.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    }),
    edu === "HIGHER_ED"
      ? Promise.resolve([])
      : prisma.schoolCohort.findMany({
          where: { organizationId: user.organizationId },
          orderBy: { name: "asc" },
          select: { id: true, name: true, gradeLabel: true, academicYearLabel: true },
        }),
    edu === "HIGHER_ED"
      ? prisma.academicDepartment.findMany({
          where: { organizationId: user.organizationId },
          orderBy: { name: "asc" },
          include: { facultyDivision: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  if (!course) notFound();
  if (!canTeacherManageCourse(user, course.createdById)) {
    redirect(`/o/${slug}/courses/${courseId}`);
  }

  const initial: EditableCourse = {
    id: course.id,
    title: course.title,
    description: course.description,
    published: course.published,
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        content: l.content,
        videoUrl: l.videoUrl,
        order: l.order,
        files: l.files.map((f) => ({ id: f.id, name: f.name, url: f.url })),
      })),
    })),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href={`/o/${slug}/courses`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          All courses
        </Link>
      </div>
      <h1 className="page-title">Edit course</h1>
      <CourseGradingPanel
        courseId={course.id}
        terms={terms}
        initial={{
          gradeWeightContinuous: course.gradeWeightContinuous,
          gradeWeightExam: course.gradeWeightExam,
          gradingScale: course.gradingScale,
          creditHours: course.creditHours,
          academicTermId: course.academicTermId,
        }}
      />
      {edu === "HIGHER_ED" ? (
        <CourseDepartmentPanel
          courseId={course.id}
          allDepartments={allDepartments.map((d) => ({
            id: d.id,
            name: d.name,
            code: d.code,
            facultyDivisionName: d.facultyDivision?.name ?? null,
          }))}
        />
      ) : (
        <CourseCohortPanel courseId={course.id} allCohorts={allCohorts} />
      )}
      <CourseEditor orgSlug={slug} initial={initial} />
    </div>
  );
}
