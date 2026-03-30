import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { isStaffRole } from "@/lib/courses/access";
import { AssessmentEditor } from "@/components/assessments/assessment-editor";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string; assessmentId: string }>;
}) {
  const { slug, courseId, assessmentId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) redirect(`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/take`);

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment || assessment.courseId !== courseId) notFound();

  const questions = await prisma.question.findMany({
    where: { assessmentId },
    orderBy: { order: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href={`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/take`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Student preview (blocked for staff — copy link for student)
        </Link>
      </div>
      <AssessmentEditor
        orgSlug={slug}
        courseId={courseId}
        initialAssessment={{
          id: assessment.id,
          title: assessment.title,
          description: assessment.description,
          kind: assessment.kind,
          semester: assessment.semester,
          timeLimitMinutes: assessment.timeLimitMinutes,
          published: assessment.published,
          shuffleQuestions: assessment.shuffleQuestions,
        }}
        initialQuestions={questions}
      />
    </div>
  );
}
