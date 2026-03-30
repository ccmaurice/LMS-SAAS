"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { formatGradeDisplay } from "@/lib/grading/scale";
import type { GradingScaleType } from "@/generated/prisma/enums";

export type ReportCardRowClient = {
  submissionId: string;
  assessmentId: string;
  assessmentTitle: string;
  courseId: string;
  courseTitle: string;
  assessmentKind: string;
  semester: number | null;
  gradingScale: string;
  totalScore: number | null;
  maxScore: number | null;
  status: string;
  submittedAt: string | null;
};

type SnapshotClient = {
  semester1AvgPercent: number | null;
  semester2AvgPercent: number | null;
  semester3AvgPercent: number | null;
  cumulativeAvgPercent: number | null;
  standing: string;
  computedAt: string;
} | null;

function pct(total: number | null, max: number | null): number | null {
  if (total == null || max == null || max <= 0) return null;
  return (total / max) * 100;
}

export function ReportCardView({
  slug,
  rows,
  snapshot,
  orgName,
  academicYearLabel,
}: {
  slug: string;
  rows: ReportCardRowClient[];
  snapshot: SnapshotClient;
  orgName: string;
  academicYearLabel: string;
}) {
  const base = `/o/${slug}`;
  const [view, setView] = useState<"all" | "1" | "2" | "3" | "cumulative">("all");

  const filtered = useMemo(() => {
    if (view === "all") return rows;
    if (view === "cumulative") return rows;
    const sem = Number(view);
    return rows.filter((r) => r.semester === sem);
  }, [rows, view]);

  return (
    <div className="report-card-print space-y-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-card-print { max-width: none !important; padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Report card</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orgName} · Academic year {academicYearLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </button>
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            ← Dashboard
          </Link>
        </div>
      </div>

      <header className="hidden print:block">
        <h1 className="text-xl font-semibold">{orgName}</h1>
        <p className="text-sm text-muted-foreground">Report card · {academicYearLabel}</p>
      </header>

      <div className="no-print flex flex-wrap gap-2">
        {(["all", "1", "2", "3", "cumulative"] as const).map((v) => (
          <button
            key={v}
            type="button"
            className={cn(
              buttonVariants({ variant: view === v ? "default" : "outline", size: "sm" }),
              "capitalize",
            )}
            onClick={() => setView(v)}
          >
            {v === "all" ? "All assessments" : v === "cumulative" ? "Cumulative (annual)" : `Semester ${v}`}
          </button>
        ))}
      </div>

      {view === "cumulative" ? (
        <div className="surface-bento space-y-4 p-6">
          <h2 className="text-lg font-semibold">Cumulative performance</h2>
          <p className="text-sm text-muted-foreground">
            Averages are computed from graded submissions on assessments tagged with semester 1–3, using each
            course&apos;s CA/exam weights. Ask your admin to run &quot;Recompute promotion snapshots&quot; after
            updating scores.
          </p>
          {snapshot ? (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3 dark:border-white/10">
                <p className="text-xs text-muted-foreground">Semester 1 avg %</p>
                <p className="text-lg font-semibold tabular-nums">
                  {snapshot.semester1AvgPercent != null ? `${snapshot.semester1AvgPercent.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 dark:border-white/10">
                <p className="text-xs text-muted-foreground">Semester 2 avg %</p>
                <p className="text-lg font-semibold tabular-nums">
                  {snapshot.semester2AvgPercent != null ? `${snapshot.semester2AvgPercent.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 dark:border-white/10">
                <p className="text-xs text-muted-foreground">Semester 3 avg %</p>
                <p className="text-lg font-semibold tabular-nums">
                  {snapshot.semester3AvgPercent != null ? `${snapshot.semester3AvgPercent.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 dark:border-white/10">
                <p className="text-xs text-muted-foreground">Cumulative · Standing</p>
                <p className="text-lg font-semibold tabular-nums">
                  {snapshot.cumulativeAvgPercent != null ? `${snapshot.cumulativeAvgPercent.toFixed(1)}%` : "—"}
                  <span className="ml-2 text-base font-medium text-primary">{snapshot.standing}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No promotion snapshot yet for this year.</p>
          )}
        </div>
      ) : null}

      {view !== "cumulative" ? (
        <div className="surface-table-wrap">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Assessment</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Sem</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const p = pct(r.totalScore, r.maxScore);
                const scale = r.gradingScale as GradingScaleType;
                return (
                  <tr key={r.submissionId}>
                    <td className="px-4 py-3 font-medium">{r.courseTitle}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`${base}/courses/${r.courseId}/assessments/${r.assessmentId}/results?submissionId=${encodeURIComponent(r.submissionId)}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {r.assessmentTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.assessmentKind}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.semester ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.totalScore != null && r.maxScore != null ? (
                        <>
                          {r.totalScore} / {r.maxScore}
                          {p != null ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({formatGradeDisplay(p, scale)})
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No assessments in this view.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
