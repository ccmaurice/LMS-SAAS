import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCourseInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
import { isStaffRole } from "@/lib/courses/access";
import { NewAssessmentForm } from "@/components/assessments/new-assessment-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { getServerT } from "@/i18n/server";

export default async function NewAssessmentPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) redirect(`/o/${slug}/courses/${courseId}/assessments`);

  const course = await assertCourseInOrg(courseId, user.organizationId);
  if (!course) notFound();
  if (!(await canTeacherActOnAssessmentCourse(user, courseId))) {
    redirect(`/o/${slug}/courses/${courseId}/assessments`);
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/o/${slug}/courses/${courseId}/assessments`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        {t("assessments.navBackToList")}
      </Link>
      <h1 className="page-title">{t("assessments.newAssessmentPageTitle")}</h1>
      <NewAssessmentForm courseId={courseId} orgSlug={slug} />
    </div>
  );
}
