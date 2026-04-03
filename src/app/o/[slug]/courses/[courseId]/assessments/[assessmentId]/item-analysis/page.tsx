import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { computeItemDiscrimination27 } from "@/lib/assessments/item-discrimination";
import { computeItemAnalysis } from "@/lib/assessments/item-analysis";

export default async function AssessmentItemAnalysisPage({
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

  const [questions, submissions, pools] = await Promise.all([
    prisma.question.findMany({
      where: { assessmentId },
      orderBy: { order: "asc" },
    }),
    prisma.submission.findMany({
      where: { assessmentId, status: "SUBMITTED" },
      select: {
        id: true,
        totalScore: true,
        maxScore: true,
        answers: {
          select: { questionId: true, content: true, score: true, manualScore: true },
        },
      },
    }),
    prisma.assessmentQuestionPool.findMany({
      where: { assessmentId },
      select: { entries: { select: { questionId: true } } },
    }),
  ]);

  const pooledQuestionIds = new Set(pools.flatMap((p) => p.entries.map((e) => e.questionId)));
  const assessmentUsesPools = pools.some((p) => p.entries.length > 0);

  const rows = computeItemAnalysis(questions, submissions, {
    pooledQuestionIds,
    assessmentUsesPools,
  });

  const discriminationSubs = submissions.map((s) => ({
    id: s.id,
    totalScore: s.totalScore,
    maxScore: s.maxScore,
    answers: s.answers.map((a) => ({ questionId: a.questionId, content: a.content })),
  }));
  const discRows = computeItemDiscrimination27(questions, discriminationSubs);

  const base = `/o/${slug}/courses/${courseId}/assessments`;
  const courseBase = `/o/${slug}/courses/${courseId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Item analysis</h1>
          <p className="mt-1 text-muted-foreground">{assessment.title}</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Per-question stats from <span className="text-foreground">submitted</span> attempts only. Mean % uses the
            effective score on each answer (manual override when present). “Full credit %” applies to auto-graded
            question types (MCQ, true/false, short answer, formula, drag-drop). MCQ / true-false / drag-drop include
            response distributions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/api/assessments/${assessmentId}/item-analysis-export`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Download TSV
          </Link>
          <Link href={`${base}/${assessmentId}/gradebook`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Gradebook
          </Link>
          <Link href={`${base}/${assessmentId}/integrity`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Integrity log
          </Link>
          <Link href={`${base}/${assessmentId}/edit`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            Edit
          </Link>
          <Link href={`${courseBase}/assessment-outcomes`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Course outcomes
          </Link>
        </div>
      </div>

      {assessmentUsesPools ? (
        <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-950 dark:text-sky-100">
          This assessment uses <span className="font-medium">question pools</span>. Students may see different items;
          rows marked as pool items can have fewer responses than the number of submissions.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left dark:border-white/10">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Prompt</th>
              <th className="px-3 py-2 font-medium">Max pts</th>
              <th className="px-3 py-2 font-medium">Responses</th>
              <th className="px-3 py-2 font-medium">Mean %</th>
              <th className="px-3 py-2 font-medium">Full credit %</th>
              <th className="min-w-[200px] px-3 py-2 font-medium">Distribution</th>
              <th className="min-w-[140px] px-3 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No questions on this assessment.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.questionId} className="border-b border-border/80 dark:border-white/10">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.type}</td>
                  <td className="max-w-xs px-3 py-2 text-foreground">{r.promptPreview}</td>
                  <td className="px-3 py-2 tabular-nums">{r.maxPoints}</td>
                  <td className="px-3 py-2 tabular-nums">{r.responseCount}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.meanPercent == null ? "—" : `${r.meanPercent.toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.fullCreditPercent == null ? "—" : `${r.fullCreditPercent.toFixed(1)}%`}
                  </td>
                  <td className="max-w-md px-3 py-2 align-top text-xs text-muted-foreground">
                    {r.distributionLines?.length ? (
                      <ul className="list-inside list-disc space-y-0.5">
                        {r.distributionLines.map((line, li) => (
                          <li key={li}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[200px] px-3 py-2 align-top text-xs text-muted-foreground">{r.note ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">High–low discrimination</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          <span className="text-foreground">p̂ overall</span> is the proportion correct among attempts with a gradable
          answer; <span className="text-foreground">r_pb</span> is the Pearson correlation between correct (0/1) and
          total score % (point-biserial-style). Students are split into the lower and upper ~27% by total score %
          when there are at least four scored attempts; then <span className="text-foreground">p̂ low</span> /{" "}
          <span className="text-foreground">p̂ high</span> and <span className="text-foreground">D = p̂ high − p̂ low</span>{" "}
          (−1…+1) summarize tail contrast. Negative D suggests the item may be misfitting or keyed wrong. Pool-based
          forms can make tails noisy if many students never saw an item.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left dark:border-white/10">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Prompt</th>
                <th className="px-3 py-2 font-medium">p̂ overall</th>
                <th className="px-3 py-2 font-medium">r_pb</th>
                <th className="px-3 py-2 font-medium">n graded</th>
                <th className="px-3 py-2 font-medium">p̂ low</th>
                <th className="px-3 py-2 font-medium">p̂ high</th>
                <th className="px-3 py-2 font-medium">D</th>
                <th className="px-3 py-2 font-medium">n low</th>
                <th className="px-3 py-2 font-medium">n high</th>
                <th className="px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {discRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">
                    No questions.
                  </td>
                </tr>
              ) : (
                discRows.map((r, i) => (
                  <tr key={r.questionId} className="border-b border-border/80 dark:border-white/10">
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.type}</td>
                    <td className="max-w-xs px-3 py-2">{r.promptPreview}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.pOverall == null ? "—" : `${(r.pOverall * 100).toFixed(0)}%`}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.pointBiserial == null ? "—" : r.pointBiserial.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.nGraded}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.pLow == null ? "—" : `${(r.pLow * 100).toFixed(0)}%`}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.pHigh == null ? "—" : `${(r.pHigh * 100).toFixed(0)}%`}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 tabular-nums font-medium",
                        r.dIndex != null && r.dIndex < 0 && "text-amber-800 dark:text-amber-200",
                      )}
                    >
                      {r.dIndex == null ? "—" : r.dIndex.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.nLow}</td>
                    <td className="px-3 py-2 tabular-nums">{r.nHigh}</td>
                    <td className="max-w-[200px] px-3 py-2 text-xs text-muted-foreground">{r.note ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        ← All assessments
      </Link>
    </div>
  );
}
