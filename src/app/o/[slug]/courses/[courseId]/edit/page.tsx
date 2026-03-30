import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canEditCourseAsStaff, isStaffRole } from "@/lib/courses/access";
import { CourseGradingPanel } from "@/components/courses/course-grading-panel";
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

  const course = await prisma.course.findFirst({
    where: { id: courseId, organizationId: user.organizationId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" }, include: { files: true } },
        },
      },
    },
  });

  if (!course) notFound();
  if (!canEditCourseAsStaff(user.role)) {
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
      <h1 className="text-2xl font-semibold tracking-tight">Edit course</h1>
      <CourseGradingPanel
        courseId={course.id}
        initial={{
          gradeWeightContinuous: course.gradeWeightContinuous,
          gradeWeightExam: course.gradeWeightExam,
          gradingScale: course.gradingScale,
        }}
      />
      <CourseEditor orgSlug={slug} initial={initial} />
    </div>
  );
}
