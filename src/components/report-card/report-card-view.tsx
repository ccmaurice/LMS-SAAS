"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { formatGradeDisplay } from "@/lib/grading/scale";
import type { EducationLevel, GradingScaleType } from "@/generated/prisma/enums";
import { OrgBrandMark } from "@/components/org/org-brand-mark";
import { escapeHtml, printHtmlInIframe } from "@/lib/print/print-html-in-iframe";

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

function viewLabelForPrint(view: "all" | "1" | "2" | "3" | "cumulative"): string {
  if (view === "all") return "All assessments";
  if (view === "cumulative") return "Cumulative (annual)";
  return `Semester ${view}`;
}

function buildReportCardPrintBody(opts: {
  orgName: string;
  orgLogoUrl?: string | null;
  academicYearLabel: string;
  educationLevel?: EducationLevel;
  gpaSummary?: { cumulativeGpa: number | null; totalCreditsGraded: number } | null;
  view: "all" | "1" | "2" | "3" | "cumulative";
  snapshot: SnapshotClient;
  assessmentRows: ReportCardRowClient[];
}): string {
  const o = escapeHtml(opts.orgName);
  const y = escapeHtml(opts.academicYearLabel);
  const brand =
    opts.orgLogoUrl?.trim() != null && opts.orgLogoUrl.trim() !== ""
      ? `<div class="brand-row"><img src="${escapeHtml(opts.orgLogoUrl.trim())}" alt="" /></div>`
      : "";
  let html = `${brand}<h1>${o}</h1><p class="muted">Report card · ${y}</p>`;

  if (opts.educationLevel === "HIGHER_ED" && opts.gpaSummary) {
    const g = opts.gpaSummary.cumulativeGpa != null ? opts.gpaSummary.cumulativeGpa.toFixed(2) : "—";
    const cr = opts.gpaSummary.totalCreditsGraded.toFixed(1);
    html += `<div class="bento"><p class="small" style="text-transform:uppercase;font-weight:600;letter-spacing:0.06em;">Cumulative GPA</p><p style="font-size:1.25rem;font-weight:600;margin:4px 0 0;">${escapeHtml(g)} <span class="muted" style="font-weight:400;">(${escapeHtml(cr)} cr. graded)</span></p></div>`;
  }

  if (opts.view === "cumulative") {
    html += `<h2>Cumulative performance</h2><p class="muted">Averages from graded submissions on assessments tagged with semesters 1–3.</p>`;
    if (opts.snapshot) {
      const s = opts.snapshot;
      const s1 = s.semester1AvgPercent != null ? `${s.semester1AvgPercent.toFixed(1)}%` : "—";
      const s2 = s.semester2AvgPercent != null ? `${s.semester2AvgPercent.toFixed(1)}%` : "—";
      const s3 = s.semester3AvgPercent != null ? `${s.semester3AvgPercent.toFixed(1)}%` : "—";
      const cum = s.cumulativeAvgPercent != null ? `${s.cumulativeAvgPercent.toFixed(1)}%` : "—";
      const st = escapeHtml(s.standing);
      html += `<div class="snapgrid">
        <div class="snapbox"><p class="small">Semester 1 avg %</p><p style="font-size:1.1rem;font-weight:600;">${escapeHtml(s1)}</p></div>
        <div class="snapbox"><p class="small">Semester 2 avg %</p><p style="font-size:1.1rem;font-weight:600;">${escapeHtml(s2)}</p></div>
        <div class="snapbox"><p class="small">Semester 3 avg %</p><p style="font-size:1.1rem;font-weight:600;">${escapeHtml(s3)}</p></div>
        <div class="snapbox"><p class="small">Cumulative · Standing</p><p style="font-size:1.1rem;font-weight:600;">${escapeHtml(cum)} <span style="font-weight:600;color:#1a1a1a;">${st}</span></p></div>
      </div>`;
    } else {
      html += `<p class="muted">No promotion snapshot yet for this year.</p>`;
    }
    return html;
  }

  html += `<p class="muted" style="margin-bottom:0;">${escapeHtml(viewLabelForPrint(opts.view))}</p>`;
  html += `<table><thead><tr><th>Course</th><th>Assessment</th><th>Kind</th><th class="num">Sem</th><th>Submitted</th><th class="num">Score</th></tr></thead><tbody>`;

  if (opts.assessmentRows.length === 0) {
    html += `<tr><td colspan="6">No assessments in this view.</td></tr>`;
  } else {
    for (const r of opts.assessmentRows) {
      const p = pct(r.totalScore, r.maxScore);
      const scale = r.gradingScale as GradingScaleType;
      const score =
        r.totalScore != null && r.maxScore != null
          ? `${r.totalScore} / ${r.maxScore}${p != null ? ` (${formatGradeDisplay(p, scale)})` : ""}`
          : "—";
      const sub = r.submittedAt ? escapeHtml(new Date(r.submittedAt).toLocaleString()) : "—";
      html += `<tr><td>${escapeHtml(r.courseTitle)}</td><td>${escapeHtml(r.assessmentTitle)}</td><td>${escapeHtml(r.assessmentKind)}</td><td class="num">${r.semester ?? "—"}</td><td style="font-size:0.85rem;">${sub}</td><td class="num">${escapeHtml(score)}</td></tr>`;
    }
  }
  html += `</tbody></table>`;
  return html;
}

export function ReportCardView({
  slug,
  rows,
  snapshot,
  orgName,
  orgLogoUrl = null,
  academicYearLabel,
  educationLevel,
  gpaSummary,
  childQuery = "",
}: {
  slug: string;
  rows: ReportCardRowClient[];
  snapshot: SnapshotClient;
  orgName: string;
  orgLogoUrl?: string | null;
  academicYearLabel: string;
  educationLevel?: EducationLevel;
  gpaSummary?: { cumulativeGpa: number | null; totalCreditsGraded: number } | null;
  /** e.g. `?child=userId` for parent viewing a linked student (PDF + transcript links) */
  childQuery?: string;
}) {
  const base = `/o/${slug}`;
  const [view, setView] = useState<"all" | "1" | "2" | "3" | "cumulative">("all");

  const filtered = useMemo(() => {
    if (view === "all") return rows;
    if (view === "cumulative") return rows;
    const sem = Number(view);
    return rows.filter((r) => r.semester === sem);
  }, [rows, view]);

  const handlePrint = () => {
    printHtmlInIframe(
      buildReportCardPrintBody({
        orgName,
        orgLogoUrl,
        academicYearLabel,
        educationLevel,
        gpaSummary,
        view,
        snapshot,
        assessmentRows: filtered,
      }),
      `Report card · ${orgName}`,
    );
  };

  return (
    <div className="report-card-print space-y-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-card-print {
            --foreground: oklch(0.16 0.01 260);
            --muted-foreground: oklch(0.42 0 0);
            --card-foreground: oklch(0.16 0.01 260);
            --popover-foreground: oklch(0.16 0.01 260);
            --border: oklch(0.88 0 0);
            --background: oklch(1 0 0);
            --card: oklch(1 0 0);
            --muted: oklch(0.96 0 0);
            --primary: oklch(0.25 0 0);
            --primary-foreground: oklch(0.99 0 0);
            --secondary: oklch(0.96 0 0);
            --secondary-foreground: oklch(0.2 0 0);
            --accent: oklch(0.96 0 0);
            --accent-foreground: oklch(0.2 0 0);
            --ring: oklch(0.55 0.12 264);
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            max-width: none !important;
            padding: 0 !important;
            color: var(--foreground);
          }
          .report-card-print .surface-table-wrap {
            overflow: visible !important;
            max-height: none !important;
            break-inside: auto;
            page-break-inside: auto;
          }
          .report-card-print .surface-bento {
            overflow: visible !important;
            max-height: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .report-card-print table {
            min-width: 0 !important;
            width: 100% !important;
            border-collapse: collapse;
          }
          .report-card-print thead {
            display: table-header-group;
          }
          .report-card-print tbody {
            display: table-row-group;
          }
          .report-card-print tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          body { background: white !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4">
          <OrgBrandMark url={orgLogoUrl} size="lg" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="page-title">Report card</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {orgName} · Academic year {academicYearLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/me/report-card-pdf${childQuery}`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Download PDF
          </a>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            onClick={handlePrint}
          >
            Print
          </button>
          {educationLevel === "HIGHER_ED" ? (
            <Link href={`${base}/transcript${childQuery}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              Full transcript &amp; GPA
            </Link>
          ) : null}
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            ← Dashboard
          </Link>
        </div>
      </div>

      <header className="hidden print:block">
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <OrgBrandMark url={orgLogoUrl} size="lg" />
          <div>
            <h1 className="text-xl font-semibold">{orgName}</h1>
            <p className="text-sm text-muted-foreground">Report card · {academicYearLabel}</p>
          </div>
        </div>
      </header>

      {educationLevel === "HIGHER_ED" && gpaSummary ? (
        <div className="surface-bento no-print flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cumulative GPA</p>
            <p className="text-xl font-semibold tabular-nums">
              {gpaSummary.cumulativeGpa != null ? gpaSummary.cumulativeGpa.toFixed(2) : "—"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({gpaSummary.totalCreditsGraded.toFixed(1)} cr. graded)
              </span>
            </p>
          </div>
          <Link href={`${base}/transcript${childQuery}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Open transcript
          </Link>
        </div>
      ) : null}

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
