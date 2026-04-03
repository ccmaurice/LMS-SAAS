"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { AcademicCalendarCopy } from "@/lib/education_context/academic-period-labels";
import type { TranscriptTermScope } from "@/lib/transcript/academic-term-scope.shared";

type TermOpt = { id: string; label: string };

function scopeToMode(scope: TranscriptTermScope): "all" | "single" | "range" {
  if (scope.kind === "all") return "all";
  if (scope.kind === "single") return "single";
  return "range";
}

export function TranscriptSessionFilters({
  basePath,
  terms,
  currentScope,
  childUserId,
  calendar,
}: {
  basePath: string;
  terms: TermOpt[];
  currentScope: TranscriptTermScope;
  /** When parent is viewing a child, preserve `child` in the query string. */
  childUserId?: string;
  calendar: AcademicCalendarCopy;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"all" | "single" | "range">(() => scopeToMode(currentScope));
  const [singleId, setSingleId] = useState(
    () => (currentScope.kind === "single" ? currentScope.termId : terms[0]?.id ?? ""),
  );
  const [fromId, setFromId] = useState(
    () => (currentScope.kind === "range" ? currentScope.fromTermId : terms[0]?.id ?? ""),
  );
  const [toId, setToId] = useState(
    () => (currentScope.kind === "range" ? currentScope.toTermId : terms[terms.length - 1]?.id ?? ""),
  );

  const childQs = useMemo(() => (childUserId ? `child=${encodeURIComponent(childUserId)}` : ""), [childUserId]);

  const apply = useCallback(() => {
    const parts: string[] = [];
    if (childQs) parts.push(childQs);
    if (mode === "all") {
      /* only child */
    } else if (mode === "single") {
      if (singleId) parts.push(`term=${encodeURIComponent(singleId)}`);
    } else {
      if (fromId && toId) {
        parts.push(`fromTerm=${encodeURIComponent(fromId)}`);
        parts.push(`toTerm=${encodeURIComponent(toId)}`);
      }
    }
    const q = parts.length > 0 ? `?${parts.join("&")}` : "";
    router.push(`${basePath}${q}`);
  }, [basePath, childQs, fromId, mode, router, singleId, toId]);

  if (terms.length === 0) {
    return (
      <div className="surface-bento no-print rounded-lg border border-border/80 p-4 text-sm text-muted-foreground dark:border-white/10">
        No academic {calendar.periodPlural} are defined yet. An admin can add them under{" "}
        <span className="text-foreground">{calendar.gradingPanelAdminRef}</span> and assign each course to a{" "}
        {calendar.periodSingular} for transcript filtering across school years.
      </div>
    );
  }

  const allLabel = `All ${calendar.periodPlural}`;
  const oneLabel = `One ${calendar.periodSingular}`;
  const rangeLabel = `${calendar.periodSingularCapitalized} range`;

  return (
    <div className="surface-bento no-print space-y-4 rounded-lg border border-border/80 p-4 dark:border-white/10">
      <div>
        <p className="text-sm font-medium text-foreground">Transcript scope</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Filter by the <span className="text-foreground">{calendar.courseFieldLabel.toLowerCase()}</span> attached to
          each course. {calendar.assessmentRollupsNote} Courses without a {calendar.periodSingular} only appear in
          “{allLabel}”.
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="radio" name="tscope" checked={mode === "all"} onChange={() => setMode("all")} />
          {allLabel}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="radio" name="tscope" checked={mode === "single"} onChange={() => setMode("single")} />
          {oneLabel}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="radio" name="tscope" checked={mode === "range"} onChange={() => setMode("range")} />
          {rangeLabel}
        </label>
      </div>
      {mode === "single" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{calendar.periodSingularCapitalized}</span>
            <select
              className="h-9 min-w-[200px] rounded-md border border-input bg-background px-2"
              value={singleId}
              onChange={(e) => setSingleId(e.target.value)}
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {mode === "range" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">From</span>
            <select
              className="h-9 min-w-[200px] rounded-md border border-input bg-background px-2"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Through</span>
            <select
              className="h-9 min-w-[200px] rounded-md border border-input bg-background px-2"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <button type="button" className={cn(buttonVariants({ size: "sm" }))} onClick={apply}>
        Apply
      </button>
    </div>
  );
}
