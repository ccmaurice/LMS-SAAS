import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canStudentOpenTakeUi, getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
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
      user.role === "ADMIN" || (await canTeacherActOnAssessmentCourse(user, courseId));
    if (privilegedStaff) {
      redirect(`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/edit`);
    }
  }

  if (!(await canStudentOpenTakeUi(user.id, assessmentId, assessment))) {
    redirect(`/o/${slug}/courses/${courseId}/assessments`);
  }

  return <TakeAssessment assessmentId={assessmentId} courseId={courseId} orgSlug={slug} />;
}
