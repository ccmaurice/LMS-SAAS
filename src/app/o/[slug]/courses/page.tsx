import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listStaffCourses, listStudentCourses } from "@/lib/courses/queries";
import { isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { CoursesStaffView, CoursesStudentView } from "@/components/courses/courses-index";
import { getServerT } from "@/i18n/server";

export default async function CoursesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }

  const base = `/o/${slug}/courses`;

  if (isStaffRole(user.role)) {
    const courses = await listStaffCourses(user.organizationId, { id: user.id, role: user.role });

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="page-title">{t("nav.courses")}</h1>
            <p className="mt-1 max-w-prose text-pretty text-muted-foreground">{t("courses.staffIntro")}</p>
          </div>
          <Link href={`${base}/new`} className={cn(buttonVariants())}>
            {t("courses.newCourse")}
          </Link>
        </div>
        {courses.length === 0 ? (
          <div className="empty-state">
            <p className="font-medium text-foreground">{t("courses.emptyTitle")}</p>
            <p className="mt-2 text-xs">{t("courses.emptyHint")}</p>
          </div>
        ) : (
          <CoursesStaffView base={base} courses={courses} />
        )}
      </div>
    );
  }

  const { enrollments, catalog } = await listStudentCourses(user.id, user.organizationId);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="page-title">{t("nav.courses")}</h1>
        <p className="mt-1 max-w-prose text-pretty text-muted-foreground">{t("courses.studentIntro")}</p>
      </div>
      <CoursesStudentView base={base} enrollments={enrollments} catalog={catalog} />
    </div>
  );
}
