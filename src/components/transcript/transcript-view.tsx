"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { OrgBrandMark } from "@/components/org/org-brand-mark";
import { escapeHtml, printHtmlInIframe } from "@/lib/print/print-html-in-iframe";

export type TranscriptRowClient = {
  courseId: string;
  courseTitle: string;
  credits: number;
  termLabel: string | null;
  percent: number | null;
  letterDisplay: string | null;
  gpaPoints: number | null;
};

export type SemesterSummaryClient = {
  semester: 1 | 2 | 3;
  avgPercent: number | null;
  termGpa: number | null;
  creditsCounted: number;
};

function buildTranscriptPrintBody(opts: {
  orgName: string;
  orgLogoUrl?: string | null;
  academicYearLabel: string;
  showGpa: boolean;
  cumulativeGpa: number | null;
  totalCreditsGraded: number;
  semesterSummaries: SemesterSummaryClient[];
  rows: TranscriptRowClient[];
}): string {
  const o = escapeHtml(opts.orgName);
  const y = escapeHtml(opts.academicYearLabel);
  const brand =
    opts.orgLogoUrl?.trim() != null && opts.orgLogoUrl.trim() !== ""
      ? `<div class="brand-row"><img src="${escapeHtml(opts.orgLogoUrl.trim())}" alt="" /></div>`
      : "";
  let html = `${brand}<h1>Official transcript</h1><p class="muted">${o} · ${y}</p>`;

  if (opts.showGpa) {
    const gpa = opts.cumulativeGpa != null ? opts.cumulativeGpa.toFixed(2) : "—";
    const cr = opts.totalCreditsGraded.toFixed(1);
    html += `<div class="bento"><div class="grid2"><div><p class="small" style="text-transform:uppercase;font-weight:600;letter-spacing:0.06em;">Cumulative GPA</p><p style="font-size:1.5rem;font-weight:600;margin:4px 0 0;">${escapeHtml(gpa)}</p><p class="small">Credit-weighted on graded courses (default 3 cr. if hours not set).</p></div><div><p class="small" style="text-transform:uppercase;font-weight:600;letter-spacing:0.06em;">Credits in GPA</p><p style="font-size:1.5rem;font-weight:600;margin:4px 0 0;">${escapeHtml(cr)}</p></div></div>`;
    if (opts.semesterSummaries.length > 0) {
      html += `<p style="margin-top:16px;font-weight:600;">GPA by semester (1–3)</p><div class="semgrid">`;
      for (const s of opts.semesterSummaries) {
        const tg = s.termGpa != null ? s.termGpa.toFixed(2) : "—";
        const ap = s.avgPercent != null ? `${s.avgPercent.toFixed(1)}%` : "—";
        const cc = s.creditsCounted.toFixed(1);
        html += `<div class="sembox"><p class="small" style="font-weight:600;">Semester ${s.semester}</p><p style="font-size:1.1rem;font-weight:600;margin:4px 0;">${escapeHtml(tg)}</p><p class="small">Avg ${escapeHtml(ap)} · ${escapeHtml(cc)} cr.</p></div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  } else {
    html += `<p class="muted">GPA columns appear for higher-ed institutions with letter or percent grading.</p>`;
  }

  html += `<table><thead><tr><th>Course</th><th>Term</th><th class="num">Credits</th><th class="num">Grade</th>`;
  if (opts.showGpa) html += `<th class="num">GPA pts</th>`;
  html += `</tr></thead><tbody>`;

  if (opts.rows.length === 0) {
    html += `<tr><td colspan="${opts.showGpa ? 5 : 4}">No course enrollments in this organization yet.</td></tr>`;
  } else {
    for (const r of opts.rows) {
      const grade =
        r.letterDisplay ?? (r.percent != null ? `${r.percent.toFixed(1)}%` : "—");
      const gp = r.gpaPoints != null ? r.gpaPoints.toFixed(2) : "—";
      html += `<tr><td>${escapeHtml(r.courseTitle)}</td><td>${escapeHtml(r.termLabel ?? "—")}</td><td class="num">${String(r.credits)}</td><td class="num">${escapeHtml(grade)}</td>`;
      if (opts.showGpa) html += `<td class="num">${escapeHtml(gp)}</td>`;
      html += `</tr>`;
    }
  }
  html += `</tbody></table>`;
  return html;
}

export function TranscriptView({
  slug,
  orgName,
  orgLogoUrl = null,
  academicYearLabel,
  showGpa,
  cumulativeGpa,
  totalCreditsGraded,
  rows,
  semesterSummaries = [],
  pdfQuery = "",
}: {
  slug: string;
  orgName: string;
  orgLogoUrl?: string | null;
  academicYearLabel: string;
  showGpa: boolean;
  cumulativeGpa: number | null;
  totalCreditsGraded: number;
  rows: TranscriptRowClient[];
  semesterSummaries?: SemesterSummaryClient[];
  /** e.g. `?child=userId` for parent viewing a specific student */
  pdfQuery?: string;
}) {
  const base = `/o/${slug}`;

  const handlePrint = () => {
    printHtmlInIframe(
      buildTranscriptPrintBody({
        orgName,
        orgLogoUrl,
        academicYearLabel,
        showGpa,
        cumulativeGpa,
        totalCreditsGraded,
        semesterSummaries,
        rows,
      }),
      `Transcript · ${orgName}`,
    );
  };

  return (
    <div className="transcript-print space-y-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          /* Dark mode uses light text; browsers often omit backgrounds when printing, so ink disappears on white paper. */
          .transcript-print {
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
          .transcript-print .surface-table-wrap {
            overflow: visible !important;
            max-height: none !important;
            break-inside: auto;
            page-break-inside: auto;
          }
          .transcript-print .surface-bento {
            overflow: visible !important;
            max-height: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .transcript-print table {
            min-width: 0 !important;
            width: 100% !important;
            border-collapse: collapse;
          }
          .transcript-print thead {
            display: table-header-group;
          }
          .transcript-print tbody {
            display: table-row-group;
          }
          .transcript-print tr {
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
            <h1 className="page-title">Academic transcript</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {orgName} · Year {academicYearLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/me/transcript-pdf${pdfQuery}`}
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
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            ← Dashboard
          </Link>
        </div>
      </div>

      <header className="hidden print:block">
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <OrgBrandMark url={orgLogoUrl} size="lg" />
          <div>
            <h1 className="text-xl font-semibold">Official transcript</h1>
            <p className="text-sm text-muted-foreground">
              {orgName} · {academicYearLabel}
            </p>
          </div>
        </div>
      </header>

      {showGpa ? (
        <div className="space-y-4">
          <div className="surface-bento grid gap-3 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cumulative GPA</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {cumulativeGpa != null ? cumulativeGpa.toFixed(2) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Credit-weighted on graded courses (default 3 cr. if hours not set). Uses semester-tagged assessments.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Credits in GPA</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{totalCreditsGraded.toFixed(1)}</p>
            </div>
          </div>
          {semesterSummaries.length > 0 ? (
            <div className="surface-bento p-5">
              <p className="text-sm font-semibold">GPA by semester (1–3)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Each column uses only assessments tagged with that semester. Empty if no tagged work yet.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {semesterSummaries.map((s) => (
                  <div key={s.semester} className="rounded-lg border border-border/80 p-3 dark:border-white/10">
                    <p className="text-xs font-medium text-muted-foreground">Semester {s.semester}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {s.termGpa != null ? s.termGpa.toFixed(2) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Avg % {s.avgPercent != null ? `${s.avgPercent.toFixed(1)}%` : "—"} · {s.creditsCounted.toFixed(1)}{" "}
                      cr.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          GPA columns are shown for higher-ed institutions with letter or percent grading. Your school can set the
          institution type under Admin → School.
        </p>
      )}

      <div className="surface-table-wrap">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Term</th>
              <th className="px-4 py-3">Credits</th>
              <th className="px-4 py-3">Grade</th>
              {showGpa ? <th className="px-4 py-3">GPA pts</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.courseId}>
                <td className="px-4 py-3 font-medium">{r.courseTitle}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.termLabel ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{r.credits}</td>
                <td className="px-4 py-3 tabular-nums">
                  {r.letterDisplay ?? (r.percent != null ? `${r.percent.toFixed(1)}%` : "—")}
                </td>
                {showGpa ? (
                  <td className="px-4 py-3 tabular-nums">
                    {r.gpaPoints != null ? r.gpaPoints.toFixed(2) : "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No course enrollments in this organization yet.</p>
        ) : null}
      </div>
    </div>
  );
}
