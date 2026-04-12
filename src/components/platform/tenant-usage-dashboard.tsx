"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MOMENTUM_WEIGHTS,
  PUBLIC_EXTRA_SECTIONS_WEIGHT_CAP,
  USAGE_WEIGHTS,
} from "@/lib/platform/tenant-usage-weights";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export type ActivityWindow = "7" | "30" | "90";

export type TenantUsageRowJson = {
  id: string;
  name: string;
  slug: string;
  status: string;
  educationLevel: string;
  createdAt: string;
  users: number;
  students: number;
  teachers: number;
  parents: number;
  admins: number;
  courses: number;
  enrollments: number;
  modules: number;
  lessons: number;
  lessonFiles: number;
  assessments: number;
  questions: number;
  submissions: number;
  answers: number;
  courseChatMessages: number;
  learningResources: number;
  blogPosts: number;
  schoolCalendarEvents: number;
  assessmentScheduleEntries: number;
  schoolPublicCmsRows: number;
  publicExtraSections: number;
  cmsEntries: number;
  orgMessages: number;
  dmThreads: number;
  dmMessages: number;
  notifications: number;
  invites: number;
  cohorts: number;
  cohortMemberships: number;
  proctoringEvents: number;
  lessonProgressRows: number;
  resourceProgressRows: number;
  gradingAuditLogs: number;
  submissionsLast7Days: number;
  submissionsLast30Days: number;
  submissionsLast90Days: number;
  lessonCompletionsLast7Days: number;
  lessonCompletionsLast30Days: number;
  lessonCompletionsLast90Days: number;
  usersJoinedLast7Days: number;
  usersJoinedLast30Days: number;
  usersJoinedLast90Days: number;
  enrollmentsLast7Days: number;
  enrollmentsLast30Days: number;
  enrollmentsLast90Days: number;
  publishedAssessments: number;
  outcomeAttentionAssessments: number;
  weightedUsageIndex: number;
  totalDataRows: number;
  momentumIndex7: number;
  momentumIndex30: number;
  momentumIndex90: number;
};

type SortKey =
  | "weightedUsageIndex"
  | "momentumWindow"
  | "activitySubmissions"
  | "activityLessonCompletions"
  | "activityUsersJoined"
  | "activityEnrollments"
  | "totalDataRows"
  | "name"
  | "users"
  | "submissions"
  | "enrollments"
  | "courses"
  | "answers"
  | "schoolPublicCmsRows"
  | "publicExtraSections"
  | "schoolCalendarEvents"
  | "assessmentScheduleEntries"
  | "publishedAssessments"
  | "outcomeAttentionAssessments";

type StatusFilter = "ALL" | "ACTIVE" | "PENDING" | "REJECTED";
type RankMode = "weighted" | "momentum";

function getMomentum(t: TenantUsageRowJson, w: ActivityWindow): number {
  if (w === "7") return t.momentumIndex7;
  if (w === "30") return t.momentumIndex30;
  return t.momentumIndex90;
}

function getActivitySubmissions(t: TenantUsageRowJson, w: ActivityWindow): number {
  if (w === "7") return t.submissionsLast7Days;
  if (w === "30") return t.submissionsLast30Days;
  return t.submissionsLast90Days;
}

function getActivityUsersJoined(t: TenantUsageRowJson, w: ActivityWindow): number {
  if (w === "7") return t.usersJoinedLast7Days;
  if (w === "30") return t.usersJoinedLast30Days;
  return t.usersJoinedLast90Days;
}

function getActivityEnrollments(t: TenantUsageRowJson, w: ActivityWindow): number {
  if (w === "7") return t.enrollmentsLast7Days;
  if (w === "30") return t.enrollmentsLast30Days;
  return t.enrollmentsLast90Days;
}

function getActivityLessonCompletions(t: TenantUsageRowJson, w: ActivityWindow): number {
  if (w === "7") return t.lessonCompletionsLast7Days;
  if (w === "30") return t.lessonCompletionsLast30Days;
  return t.lessonCompletionsLast90Days;
}

function windowLabel(w: ActivityWindow): string {
  if (w === "7") return "7d";
  if (w === "30") return "30d";
  return "90d";
}

function statusBadge(status: string) {
  if (status === "PENDING") {
    return (
      <Badge variant="outline" className="border-amber-500/60 text-amber-900 dark:text-amber-100">
        Pending
      </Badge>
    );
  }
  if (status === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">Active</Badge>;
}

function pctOfPlatform(weight: number, platformSum: number): string {
  if (platformSum <= 0) return "—";
  return `${((weight / platformSum) * 100).toFixed(1)}%`;
}

export function TenantUsageDashboard({ tenants }: { tenants: TenantUsageRowJson[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("weightedUsageIndex");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(tenants[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [activityWindow, setActivityWindow] = useState<ActivityWindow>("30");
  const [rankMode, setRankMode] = useState<RankMode>("weighted");

  const platformWeightedSum = useMemo(
    () => tenants.reduce((s, t) => s + t.weightedUsageIndex, 0),
    [tenants],
  );

  const platformMomentumSum = useMemo(() => {
    return tenants.reduce((s, t) => s + getMomentum(t, activityWindow), 0);
  }, [tenants, activityWindow]);

  const filtered = useMemo(() => {
    let list = tenants;
    if (statusFilter !== "ALL") {
      list = list.filter((t) => t.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
    }
    return list;
  }, [tenants, statusFilter, search]);

  const selectedIdEffective = useMemo(() => {
    if (selectedId && filtered.some((t) => t.id === selectedId)) return selectedId;
    return filtered[0]?.id ?? null;
  }, [filtered, selectedId]);

  const compareSort = useCallback(
    (a: TenantUsageRowJson, b: TenantUsageRowJson, dir: number): number => {
      if (sortKey === "name") {
        return dir * a.name.localeCompare(b.name);
      }
      if (sortKey === "momentumWindow") {
        const av = getMomentum(a, activityWindow);
        const bv = getMomentum(b, activityWindow);
        if (av === bv) return a.name.localeCompare(b.name);
        return dir * (av > bv ? 1 : -1);
      }
      if (sortKey === "activitySubmissions") {
        const av = getActivitySubmissions(a, activityWindow);
        const bv = getActivitySubmissions(b, activityWindow);
        if (av === bv) return a.name.localeCompare(b.name);
        return dir * (av > bv ? 1 : -1);
      }
      if (sortKey === "activityLessonCompletions") {
        const av = getActivityLessonCompletions(a, activityWindow);
        const bv = getActivityLessonCompletions(b, activityWindow);
        if (av === bv) return a.name.localeCompare(b.name);
        return dir * (av > bv ? 1 : -1);
      }
      if (sortKey === "activityUsersJoined") {
        const av = getActivityUsersJoined(a, activityWindow);
        const bv = getActivityUsersJoined(b, activityWindow);
        if (av === bv) return a.name.localeCompare(b.name);
        return dir * (av > bv ? 1 : -1);
      }
      if (sortKey === "activityEnrollments") {
        const av = getActivityEnrollments(a, activityWindow);
        const bv = getActivityEnrollments(b, activityWindow);
        if (av === bv) return a.name.localeCompare(b.name);
        return dir * (av > bv ? 1 : -1);
      }
      if (
        sortKey === "publishedAssessments" ||
        sortKey === "outcomeAttentionAssessments" ||
        sortKey === "schoolCalendarEvents" ||
        sortKey === "assessmentScheduleEntries"
      ) {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === bv) return a.name.localeCompare(b.name);
        return dir * (av > bv ? 1 : -1);
      }
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      if (av === bv) return a.name.localeCompare(b.name);
      return dir * (av > bv ? 1 : -1);
    },
    [sortKey, activityWindow],
  );

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const list = [...filtered];
    list.sort((a, b) => compareSort(a, b, dir));
    return list;
  }, [filtered, sortDir, compareSort]);

  const totals = useMemo(() => {
    let weighted = 0;
    let rows = 0;
    let users = 0;
    let submissions = 0;
    let subWindow = 0;
    let lessonCmpWindow = 0;
    let momWindow = 0;
    let outcomeAttention = 0;
    for (const t of tenants) {
      weighted += t.weightedUsageIndex;
      rows += t.totalDataRows;
      users += t.users;
      submissions += t.submissions;
      subWindow += getActivitySubmissions(t, activityWindow);
      lessonCmpWindow += getActivityLessonCompletions(t, activityWindow);
      momWindow += getMomentum(t, activityWindow);
      outcomeAttention += t.outcomeAttentionAssessments;
    }
    return { weighted, rows, users, submissions, subWindow, lessonCmpWindow, momWindow, outcomeAttention };
  }, [tenants, activityWindow]);

  const maxRankValue = useMemo(() => {
    if (filtered.length === 0) return 1;
    if (rankMode === "weighted") {
      return Math.max(1, ...filtered.map((t) => t.weightedUsageIndex));
    }
    return Math.max(1, ...filtered.map((t) => getMomentum(t, activityWindow)));
  }, [filtered, rankMode, activityWindow]);

  const topForChart = useMemo(() => {
    const list = [...filtered];
    if (rankMode === "weighted") {
      list.sort((a, b) => b.weightedUsageIndex - a.weightedUsageIndex);
    } else {
      list.sort((a, b) => getMomentum(b, activityWindow) - getMomentum(a, activityWindow));
    }
    return list.slice(0, 12);
  }, [filtered, rankMode, activityWindow]);

  const selected = useMemo(() => {
    if (!selectedIdEffective) return null;
    return tenants.find((t) => t.id === selectedIdEffective) ?? null;
  }, [tenants, selectedIdEffective]);

  const chartMetrics = useMemo(() => {
    const w = activityWindow;
    const subKey =
      w === "7"
        ? ("submissionsLast7Days" as const)
        : w === "30"
          ? ("submissionsLast30Days" as const)
          : ("submissionsLast90Days" as const);
    const enKey =
      w === "7"
        ? ("enrollmentsLast7Days" as const)
        : w === "30"
          ? ("enrollmentsLast30Days" as const)
          : ("enrollmentsLast90Days" as const);
    const uKey =
      w === "7"
        ? ("usersJoinedLast7Days" as const)
        : w === "30"
          ? ("usersJoinedLast30Days" as const)
          : ("usersJoinedLast90Days" as const);
    const lesKey =
      w === "7"
        ? ("lessonCompletionsLast7Days" as const)
        : w === "30"
          ? ("lessonCompletionsLast30Days" as const)
          : ("lessonCompletionsLast90Days" as const);
    const wl = windowLabel(w);
    return [
      { key: subKey, label: `Submissions (${wl})` },
      { key: lesKey, label: `Lesson completions (${wl})` },
      { key: enKey, label: `New enrollments (${wl})` },
      { key: uKey, label: `New users (${wl})` },
      { key: "momentumIndex7" as const, label: "Momentum (7d)" },
      { key: "momentumIndex30" as const, label: "Momentum (30d)" },
      { key: "momentumIndex90" as const, label: "Momentum (90d)" },
      { key: "submissions" as const, label: "Submissions (all time)" },
      { key: "answers" as const, label: "Answers" },
      { key: "enrollments" as const, label: "Enrollments" },
      { key: "users" as const, label: "Users" },
      { key: "lessons" as const, label: "Lessons" },
      { key: "questions" as const, label: "Questions" },
      { key: "lessonFiles" as const, label: "Lesson files" },
      { key: "learningResources" as const, label: "Library items" },
      { key: "courseChatMessages" as const, label: "Course chat" },
      { key: "dmMessages" as const, label: "DM messages" },
      { key: "schoolPublicCmsRows" as const, label: "Public school CMS rows" },
      { key: "publicExtraSections" as const, label: "Custom public sections" },
      { key: "cmsEntries" as const, label: "CMS entries (all keys)" },
      { key: "publishedAssessments" as const, label: "Published assessments" },
      { key: "outcomeAttentionAssessments" as const, label: "Outcome attention (published)" },
      { key: "schoolCalendarEvents" as const, label: "School calendar events" },
      { key: "assessmentScheduleEntries" as const, label: "Assessment schedule rows" },
    ] as { key: keyof TenantUsageRowJson; label: string }[];
  }, [activityWindow]);

  const chartMax = useMemo(() => {
    if (!selected) return 1;
    return Math.max(1, ...chartMetrics.map((m) => selected[m.key] as number));
  }, [selected, chartMetrics]);

  const toggleSort = useCallback((k: SortKey) => {
    setSortKey((prev) => {
      if (prev === k) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        return prev;
      }
      setSortDir(k === "name" ? "asc" : "desc");
      return k;
    });
  }, []);

  function exportCsv() {
    const headers = [
      "name",
      "slug",
      "status",
      "educationLevel",
      "percentOfPlatformWeighted",
      "weightedUsageIndex",
      "momentumIndex7",
      "momentumIndex30",
      "momentumIndex90",
      "percentOfPlatformMomentum30d",
      "totalDataRows",
      "users",
      "students",
      "teachers",
      "courses",
      "enrollments",
      "submissions",
      "submissionsLast7Days",
      "submissionsLast30Days",
      "submissionsLast90Days",
      "lessonCompletionsLast7Days",
      "lessonCompletionsLast30Days",
      "lessonCompletionsLast90Days",
      "usersJoinedLast7Days",
      "usersJoinedLast30Days",
      "usersJoinedLast90Days",
      "enrollmentsLast7Days",
      "enrollmentsLast30Days",
      "enrollmentsLast90Days",
      "answers",
      "lessons",
      "questions",
      "cmsEntries",
      "schoolPublicCmsRows",
      "publicExtraSections",
      "publicExtraSectionsForIndex",
      "publishedAssessments",
      "outcomeAttentionAssessments",
      "schoolCalendarEvents",
      "assessmentScheduleEntries",
    ];
    const mom30Sum = tenants.reduce((s, t) => s + t.momentumIndex30, 0);
    const lines = [
      headers.join(","),
      ...sorted.map((t) => {
        const row: Record<string, string | number> = {
          name: t.name,
          slug: t.slug,
          status: t.status,
          educationLevel: t.educationLevel,
          percentOfPlatformWeighted:
            platformWeightedSum > 0 ? ((t.weightedUsageIndex / platformWeightedSum) * 100).toFixed(2) : "",
          weightedUsageIndex: t.weightedUsageIndex,
          momentumIndex7: t.momentumIndex7,
          momentumIndex30: t.momentumIndex30,
          momentumIndex90: t.momentumIndex90,
          percentOfPlatformMomentum30d: mom30Sum > 0 ? ((t.momentumIndex30 / mom30Sum) * 100).toFixed(2) : "",
          totalDataRows: t.totalDataRows,
          users: t.users,
          students: t.students,
          teachers: t.teachers,
          courses: t.courses,
          enrollments: t.enrollments,
          submissions: t.submissions,
          submissionsLast7Days: t.submissionsLast7Days,
          submissionsLast30Days: t.submissionsLast30Days,
          submissionsLast90Days: t.submissionsLast90Days,
          lessonCompletionsLast7Days: t.lessonCompletionsLast7Days,
          lessonCompletionsLast30Days: t.lessonCompletionsLast30Days,
          lessonCompletionsLast90Days: t.lessonCompletionsLast90Days,
          usersJoinedLast7Days: t.usersJoinedLast7Days,
          usersJoinedLast30Days: t.usersJoinedLast30Days,
          usersJoinedLast90Days: t.usersJoinedLast90Days,
          enrollmentsLast7Days: t.enrollmentsLast7Days,
          enrollmentsLast30Days: t.enrollmentsLast30Days,
          enrollmentsLast90Days: t.enrollmentsLast90Days,
          answers: t.answers,
          lessons: t.lessons,
          questions: t.questions,
          cmsEntries: t.cmsEntries,
          schoolPublicCmsRows: t.schoolPublicCmsRows,
          publicExtraSections: t.publicExtraSections,
          publicExtraSectionsForIndex: Math.min(t.publicExtraSections, PUBLIC_EXTRA_SECTIONS_WEIGHT_CAP),
          publishedAssessments: t.publishedAssessments,
          outcomeAttentionAssessments: t.outcomeAttentionAssessments,
          schoolCalendarEvents: t.schoolCalendarEvents,
          assessmentScheduleEntries: t.assessmentScheduleEntries,
        };
        return headers
          .map((h) => {
            const v = row[h] ?? "";
            const s = String(v);
            return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tenant-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const wLabel = windowLabel(activityWindow);

  return (
    <div className="space-y-10">
      <section className="surface-bento space-y-3 p-5">
        <h2 className="text-lg font-semibold">How to read this</h2>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Weighted index</strong> blends cumulative data with a 30d activity slice
          (see <code className="rounded bg-muted px-1">USAGE_WEIGHTS</code>).{" "}
          <strong className="text-foreground">Custom public sections</strong> (marketing page cards) use the same weight as
          one CMS entry each, up to <strong className="text-foreground">{PUBLIC_EXTRA_SECTIONS_WEIGHT_CAP}</strong> sections
          in the weighted index (full counts stay in the table and CSV); <strong className="text-foreground">public school CMS
          rows</strong> is informational (subset of total CMS entries).{" "}
          <strong className="text-foreground">Lesson completions (7d / 30d / 90d)</strong> match each school’s{" "}
          <strong className="text-foreground">Admin → Analytics → Last 7 days → Lesson completions</strong> when the
          window is 7d (same SQL scope as submissions: org courses only).{" "}
          <strong className="text-foreground">Momentum</strong> scores are separate: only recent submissions, new users,
          and new enrollments for <strong className="text-foreground">7 / 30 / 90 days</strong> — good for spotting who
          is heating up without re-weighting the whole model. Tune momentum multipliers in{" "}
          <code className="rounded bg-muted px-1">MOMENTUM_WEIGHTS</code> in the same file.{" "}
          <strong className="text-foreground">% platform</strong> uses full-fleet weighted sum;{" "}
          <strong className="text-foreground">% mom.</strong> uses the sum of momentum for the selected window. CSV export
          includes <code className="rounded bg-muted px-1">publicExtraSectionsForIndex</code> (capped count used in the
          weighted index) next to the raw card count.{" "}
          <strong className="text-foreground">Published assessments</strong> and{" "}
          <strong className="text-foreground">outcome attention</strong> use the same staff rules as each school’s{" "}
          <em>Assessment outcomes → Needs attention</em> (low class mean with enough scored attempts, or low participation
          with enough enrollments); they are not part of the billing-weighted index.{" "}
          <strong className="text-foreground">School calendar events</strong> and{" "}
          <strong className="text-foreground">assessment schedule rows</strong> count org-wide calendar entries and
          structured assessment windows (dashboard calendar + notifications); both contribute to{" "}
          <code className="rounded bg-muted px-1">USAGE_WEIGHTS</code> like other content tables.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        <div className="surface-bento p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organizations</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{tenants.length}</p>
        </div>
        <div className="surface-bento p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Users (fleet)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totals.users.toLocaleString()}</p>
        </div>
        <div className="surface-bento p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Σ weighted index</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totals.weighted.toLocaleString()}</p>
        </div>
        <div className="surface-bento p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submissions (all time)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totals.submissions.toLocaleString()}</p>
        </div>
        <div className="surface-bento p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted ({wLabel})</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totals.subWindow.toLocaleString()}</p>
        </div>
        <div className="surface-bento p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lessons done ({wLabel})</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totals.lessonCmpWindow.toLocaleString()}</p>
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">Fleet sum; mirrors school analytics</p>
        </div>
        <div className="surface-bento p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Σ momentum ({wLabel})</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totals.momWindow.toLocaleString()}</p>
        </div>
        <div className="surface-bento p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Σ outcome attention</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totals.outcomeAttention.toLocaleString()}</p>
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">Published asmt. staff flags (fleet)</p>
        </div>
      </div>

      <section className="surface-bento space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="usage-search">Search</Label>
            <Input
              id="usage-search"
              placeholder="School name or slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usage-status">Status</Label>
            <select
              id="usage-status"
              className="flex h-9 min-w-[160px] rounded-md border border-input bg-background px-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Activity window</Label>
            <div className="flex rounded-md border border-input p-0.5">
              {(["7", "30", "90"] as ActivityWindow[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setActivityWindow(w)}
                  className={cn(
                    "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                    activityWindow === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {w === "7" ? "7d" : w === "30" ? "30d" : "90d"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing <strong className="text-foreground">{filtered.length}</strong> of {tenants.length} organizations.
          Fleet KPIs use all tenants; table, chart, and % mom. follow filters + window.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Top tenants (filtered)</h2>
            <p className="text-sm text-muted-foreground">
              Rank by overall index or momentum. Numbers on the right show the active metric + % of fleet weighted.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Rank chart by</Label>
            <div className="flex rounded-md border border-input p-0.5">
              <button
                type="button"
                onClick={() => setRankMode("weighted")}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  rankMode === "weighted" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                Weighted index
              </button>
              <button
                type="button"
                onClick={() => setRankMode("momentum")}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  rankMode === "momentum" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                Momentum ({wLabel})
              </button>
            </div>
          </div>
        </div>
        <div className="surface-bento space-y-3 p-4">
          {topForChart.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations match filters.</p>
          ) : (
            topForChart.map((t) => {
              const primary = rankMode === "weighted" ? t.weightedUsageIndex : getMomentum(t, activityWindow);
              const secondary = rankMode === "weighted" ? getMomentum(t, activityWindow) : t.weightedUsageIndex;
              const pct = (primary / maxRankValue) * 100;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "block w-full rounded-lg border border-transparent text-left transition-colors",
                    selectedIdEffective === t.id ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
                    <span className="min-w-0 truncate text-sm font-medium">{t.name}</span>
                    <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      <span className="font-medium text-foreground">{primary.toLocaleString()}</span>
                      <span className="ml-2 text-muted-foreground/80">
                        ({pctOfPlatform(t.weightedUsageIndex, platformWeightedSum)} wt)
                      </span>
                      <span className="ml-1 block text-[10px] text-muted-foreground/90 sm:ml-2 sm:inline">
                        mom {secondary.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted px-2 pb-2">
                    <div
                      className="h-full rounded-full bg-primary/80 transition-all dark:bg-primary/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {selected ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Feature mix — {selected.name}</h2>
            <Link href={`/platform/orgs/${selected.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Org details
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            First rows follow the selected activity window; all three momentum scores are shown for comparison.
          </p>
          <div className="surface-bento space-y-3 p-4">
            {chartMetrics.map(({ key, label }) => {
              const n = selected[key] as number;
              const pct = (n / chartMax) * 100;
              return (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="tabular-nums text-foreground">{n.toLocaleString()}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-600/80 dark:bg-emerald-500/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Full comparison</h2>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
        <div className="surface-table-wrap overflow-x-auto">
          <table className="w-full min-w-[1920px] text-sm">
            <thead className="text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-3 py-2">
                  <button type="button" className="underline-offset-2 hover:underline" onClick={() => toggleSort("name")}>
                    School {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">% wt</th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("weightedUsageIndex")}
                  >
                    Weighted {sortKey === "weightedUsageIndex" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">% mom.</th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("momentumWindow")}
                  >
                    Mom. ({wLabel}) {sortKey === "momentumWindow" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button type="button" className="underline-offset-2 hover:underline" onClick={() => toggleSort("users")}>
                    Users {sortKey === "users" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("courses")}
                  >
                    Courses {sortKey === "courses" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("enrollments")}
                  >
                    Enroll. {sortKey === "enrollments" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("activitySubmissions")}
                  >
                    Sub {wLabel}{" "}
                    {sortKey === "activitySubmissions" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("activityLessonCompletions")}
                  >
                    Les. cmp. {wLabel}{" "}
                    {sortKey === "activityLessonCompletions" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("activityUsersJoined")}
                  >
                    New u. {wLabel}{" "}
                    {sortKey === "activityUsersJoined" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("activityEnrollments")}
                  >
                    New enr. {wLabel}{" "}
                    {sortKey === "activityEnrollments" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("submissions")}
                  >
                    Subm. Σ {sortKey === "submissions" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("publishedAssessments")}
                  >
                    Pub. asmt. {sortKey === "publishedAssessments" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("outcomeAttentionAssessments")}
                  >
                    Out. attn. {sortKey === "outcomeAttentionAssessments" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("schoolCalendarEvents")}
                  >
                    Cal. evt. {sortKey === "schoolCalendarEvents" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("assessmentScheduleEntries")}
                  >
                    Sched. rows {sortKey === "assessmentScheduleEntries" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("answers")}
                  >
                    Ans. {sortKey === "answers" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("totalDataRows")}
                  >
                    Rows {sortKey === "totalDataRows" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("schoolPublicCmsRows")}
                  >
                    Pub. CMS {sortKey === "schoolPublicCmsRows" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => toggleSort("publicExtraSections")}
                  >
                    Cards {sortKey === "publicExtraSections" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr
                  key={t.id}
                  className={cn(
                    "border-t border-border/70 dark:border-white/10",
                    selectedIdEffective === t.id ? "bg-primary/5" : "",
                  )}
                >
                  <td className="px-3 py-2 font-medium">
                    <button type="button" className="text-left hover:underline" onClick={() => setSelectedId(t.id)}>
                      {t.name}
                    </button>
                    <div className="text-xs font-normal text-muted-foreground">{t.slug}</div>
                  </td>
                  <td className="px-3 py-2">{statusBadge(t.status)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {pctOfPlatform(t.weightedUsageIndex, platformWeightedSum)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{t.weightedUsageIndex.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {pctOfPlatform(getMomentum(t, activityWindow), platformMomentumSum)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{getMomentum(t, activityWindow).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.users.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.courses.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.enrollments.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {getActivitySubmissions(t, activityWindow).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {getActivityLessonCompletions(t, activityWindow).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {getActivityUsersJoined(t, activityWindow).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {getActivityEnrollments(t, activityWindow).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.submissions.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.publishedAssessments.toLocaleString()}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      t.outcomeAttentionAssessments > 0 && "font-medium text-amber-900 dark:text-amber-100",
                    )}
                  >
                    {t.outcomeAttentionAssessments.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {t.schoolCalendarEvents.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {t.assessmentScheduleEntries.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.answers.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {t.totalDataRows.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {t.schoolPublicCmsRows.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {t.publicExtraSections.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/platform/orgs/${t.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details className="surface-bento group p-5">
        <summary className="cursor-pointer text-sm font-semibold marker:text-muted-foreground">
          Weight maps — click to expand
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          <code className="rounded bg-muted px-1">USAGE_WEIGHTS</code> drives the main billing index;{" "}
          <code className="rounded bg-muted px-1">MOMENTUM_WEIGHTS</code> drives 7d / 30d / 90d momentum only.
        </p>
        <p className="mt-3 text-xs font-medium text-foreground">USAGE_WEIGHTS</p>
        <ul className="mt-1 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(USAGE_WEIGHTS) as [keyof typeof USAGE_WEIGHTS, number][]).map(([k, v]) => (
            <li key={k} className="flex justify-between gap-2 rounded-md border border-border/60 px-2 py-1 dark:border-white/10">
              <span className="text-muted-foreground">{k}</span>
              <span className="tabular-nums font-medium">{v}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs font-medium text-foreground">MOMENTUM_WEIGHTS</p>
        <ul className="mt-1 grid gap-1 text-xs sm:grid-cols-3">
          {(Object.entries(MOMENTUM_WEIGHTS) as [keyof typeof MOMENTUM_WEIGHTS, number][]).map(([k, v]) => (
            <li key={k} className="flex justify-between gap-2 rounded-md border border-border/60 px-2 py-1 dark:border-white/10">
              <span className="text-muted-foreground">{k}</span>
              <span className="tabular-nums font-medium">{v}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
