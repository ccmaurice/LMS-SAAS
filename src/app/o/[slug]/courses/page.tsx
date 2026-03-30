import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listStaffCourses, listStudentCourses } from "@/lib/courses/queries";
import { isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { CoursesStaffView, CoursesStudentView } from "@/components/courses/courses-index";

export default async function CoursesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }

  const base = `/o/${slug}/courses`;

  if (isStaffRole(user.role)) {
    const courses = await listStaffCourses(user.organizationId);

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
            <p className="text-muted-foreground">Create and publish courses for your organization.</p>
          </div>
          <Link href={`${base}/new`} className={cn(buttonVariants())}>
            New course
          </Link>
        </div>
        <CoursesStaffView base={base} courses={courses} />
        {courses.length === 0 ? (
          <p className="text-muted-foreground">No courses yet. Create one to get started.</p>
        ) : null}
      </div>
    );
  }

  const { enrollments, catalog } = await listStudentCourses(user.id, user.organizationId);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        <p className="text-muted-foreground">Enroll in published courses or continue where you left off.</p>
      </div>
      <CoursesStudentView base={base} enrollments={enrollments} catalog={catalog} />
    </div>
  );
}
