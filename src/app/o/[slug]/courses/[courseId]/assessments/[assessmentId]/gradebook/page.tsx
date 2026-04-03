import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";
import { GradebookTable } from "@/components/assessments/gradebook-table";
import { GradebookRetakeRequests } from "@/components/assessments/gradebook-retake-requests";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { aggregateProctorEventsBySubmission } from "@/lib/assessments/proctoring-summary";

export default async function GradebookPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string; assessmentId: string }>;
}) {
  const { slug, courseId, assessmentId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) redirect(`/o/${slug}/courses/${courseId}/assessments`);

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment || assessment.courseId !== courseId) notFound();
  if (!canTeacherManageCourse(user, assessment.course.createdById)) {
    redirect(`/o/${slug}/courses/${courseId}/assessments`);
  }

  const submissions = await prisma.submission.findMany({
    where: { assessmentId },
    orderBy: { submittedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      answers: { include: { question: true } },
    },
  });

  const submissionIds = submissions.map((s) => s.id);
  const proctorRows =
    submissionIds.length > 0
      ? await prisma.proctoringEvent.findMany({
          where: { assessmentId, submissionId: { in: submissionIds } },
          select: { submissionId: true, eventType: true },
        })
      : [];
  const proctorBySubmissionId = aggregateProctorEventsBySubmission(proctorRows);

  const base = `/o/${slug}/courses/${courseId}/assessments`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Gradebook · {assessment.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/${assessmentId}/item-analysis`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Item analysis
          </Link>
          <Link
            href={`${base}/${assessmentId}/integrity`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Integrity log
          </Link>
          <Link href={`${base}/${assessmentId}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Edit assessment
          </Link>
        </div>
      </div>
      <GradebookRetakeRequests assessmentId={assessmentId} />
      <GradebookTable
        initial={JSON.parse(JSON.stringify(submissions))}
        proctorBySubmissionId={proctorBySubmissionId}
      />
    </div>
  );
}
