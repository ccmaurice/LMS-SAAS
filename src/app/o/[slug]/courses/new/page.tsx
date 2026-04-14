import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { CourseCreateForm } from "@/components/courses/course-create-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { getServerT } from "@/i18n/server";

export default async function NewCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }
  if (!isStaffRole(user.role)) {
    redirect(`/o/${slug}/courses`);
  }

  return (
    <div className="space-y-6">
      <Link href={`/o/${slug}/courses`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        {t("courses.backToAllCourses")}
      </Link>
      <div>
        <h1 className="page-title">{t("courses.newCourse")}</h1>
        <p className="text-muted-foreground">{t("courses.createShellHint")}</p>
      </div>
      <CourseCreateForm orgSlug={slug} />
    </div>
  );
}
