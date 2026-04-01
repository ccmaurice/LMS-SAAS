import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canStudentTakeAssessment, getAssessmentInOrg } from "@/lib/assessments/access";
import { isStaffRole } from "@/lib/courses/access";
import { TakeAssessment } from "@/components/assessments/take-assessment";

export default async function TakeAssessmentPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string; assessmentId: string }>;
}) {
  const { slug, courseId, assessmentId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment || assessment.courseId !== courseId) redirect(`/o/${slug}/courses/${courseId}/assessments`);

  if (isStaffRole(user.role)) {
    const privilegedStaff =
      user.role === "ADMIN" || user.id === assessment.course.createdById;
    if (privilegedStaff) {
      redirect(`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/edit`);
    }
  }

  if (!(await canStudentTakeAssessment(user.id, assessment))) {
    redirect(`/o/${slug}/courses/${courseId}/assessments`);
  }

  return <TakeAssessment assessmentId={assessmentId} courseId={courseId} orgSlug={slug} />;
}
