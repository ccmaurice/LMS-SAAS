import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { isStaffRole } from "@/lib/courses/access";
import { GradebookTable } from "@/components/assessments/gradebook-table";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

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

  const submissions = await prisma.submission.findMany({
    where: { assessmentId },
    orderBy: { submittedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      answers: { include: { question: true } },
    },
  });

  const base = `/o/${slug}/courses/${courseId}/assessments`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Gradebook · {assessment.title}</h1>
        <Link href={`${base}/${assessmentId}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Edit assessment
        </Link>
      </div>
      <GradebookTable initial={JSON.parse(JSON.stringify(submissions))} />
    </div>
  );
}
