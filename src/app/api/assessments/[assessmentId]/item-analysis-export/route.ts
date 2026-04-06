import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
import { isStaffRole } from "@/lib/courses/access";
import { computeItemDiscrimination27 } from "@/lib/assessments/item-discrimination";
import { computeItemAnalysis, formatDistributionForTsv } from "@/lib/assessments/item-analysis";

function escapeTsvField(s: string): string {
  return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

export async function GET(_req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaffRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canTeacherActOnAssessmentCourse(user, assessment.courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const discByQuestionId = new Map(discRows.map((d) => [d.questionId, d]));

  const header = [
    "order",
    "type",
    "promptPreview",
    "maxPoints",
    "responseCount",
    "meanPercent",
    "fullCreditPercent",
    "distribution",
    "note",
    "disc_pOverallPct",
    "disc_rPointBiserial",
    "disc_nGraded",
    "disc_pLowPct",
    "disc_pHighPct",
    "disc_D",
    "disc_nLow",
    "disc_nHigh",
    "disc_note",
  ];
  const lines = [
    header.join("\t"),
    ...rows.map((r, i) => {
      const d = discByQuestionId.get(r.questionId);
      return [
        String(i + 1),
        r.type,
        r.promptPreview,
        String(r.maxPoints),
        String(r.responseCount),
        r.meanPercent == null ? "" : r.meanPercent.toFixed(2),
        r.fullCreditPercent == null ? "" : r.fullCreditPercent.toFixed(2),
        formatDistributionForTsv(r.distributionLines),
        r.note ?? "",
        d?.pOverall == null ? "" : (d.pOverall * 100).toFixed(2),
        d?.pointBiserial == null ? "" : d.pointBiserial.toFixed(4),
        d ? String(d.nGraded) : "",
        d?.pLow == null ? "" : (d.pLow * 100).toFixed(2),
        d?.pHigh == null ? "" : (d.pHigh * 100).toFixed(2),
        d?.dIndex == null ? "" : d.dIndex.toFixed(4),
        d ? String(d.nLow) : "",
        d ? String(d.nHigh) : "",
        d?.note ?? "",
      ]
        .map((c) => escapeTsvField(String(c)))
        .join("\t");
    }),
  ];

  const body = lines.join("\n");
  const filename = `item-analysis-${assessmentId.slice(0, 10)}.tsv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
