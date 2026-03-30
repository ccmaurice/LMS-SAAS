import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function AssessmentResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; courseId: string; assessmentId: string }>;
  searchParams: Promise<{ submissionId?: string }>;
}) {
  const { slug, courseId, assessmentId } = await params;
  const { submissionId } = await searchParams;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment || assessment.courseId !== courseId) notFound();

  if (!submissionId) {
    return (
      <p className="text-muted-foreground">
        No submission selected.{" "}
        <Link href={`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/take`} className="text-primary underline">
          Take assessment
        </Link>
      </p>
    );
  }

  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      userId: user.id,
      assessmentId,
    },
    include: {
      answers: { include: { question: true } },
    },
  });

  if (!submission) notFound();

  const base = `/o/${slug}/courses/${courseId}/assessments`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        ← Assessments
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Results · {assessment.title}</h1>
      <p className="text-muted-foreground">
        Status: {submission.status} · Score: {submission.totalScore ?? "—"} / {submission.maxScore ?? "—"}
      </p>
      <ul className="space-y-6">
        {submission.answers.map((a) => (
          <li key={a.id} className="surface-bento p-5 text-sm">
            <p className="text-xs text-muted-foreground">
              {a.question.type} · Your score:{" "}
              {a.manualScore != null ? a.manualScore : (a.score ?? "—")} / {a.question.points}
            </p>
            <p className="mt-1 whitespace-pre-wrap font-medium">{a.question.prompt}</p>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">Your answer: {a.content || "(empty)"}</p>
            {submission.status !== "DRAFT" ? (
              <div className="mt-3 border-t border-border/80 pt-3 text-xs text-muted-foreground dark:border-white/10">
                {a.question.type === "MCQ" && a.question.options ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap">
                    Key: {JSON.stringify(a.question.options, null, 2)}
                  </pre>
                ) : null}
                {a.question.correctAnswer ? <p>Expected (short answer): {a.question.correctAnswer}</p> : null}
                {a.aiFeedback ? (
                  <p className="mt-2 text-foreground whitespace-pre-wrap">AI feedback: {a.aiFeedback}</p>
                ) : null}
                {a.manualComment ? <p className="mt-2 text-foreground">Instructor: {a.manualComment}</p> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
