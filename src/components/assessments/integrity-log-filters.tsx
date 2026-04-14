"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  INTEGRITY_EVENT_TYPES,
  INTEGRITY_PAGE_SIZE,
  integrityExportSearchParams,
} from "@/lib/assessments/integrity-query";
import { proctorEventTypeLabel } from "@/lib/assessments/proctoring-summary";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";

export function IntegrityLogFilters({
  integrityPath,
  exportApiPath,
  initialStudent,
  initialEventType,
  initialFrom,
  initialTo,
  initialHideExcused,
  currentPage,
  totalCount,
}: {
  integrityPath: string;
  exportApiPath: string;
  initialStudent: string;
  initialEventType: string;
  initialFrom: string;
  initialTo: string;
  initialHideExcused: boolean;
  currentPage: number;
  totalCount: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [student, setStudent] = useState(initialStudent);
  const [eventType, setEventType] = useState(initialEventType);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [hideExcused, setHideExcused] = useState(initialHideExcused);

  useEffect(() => {
    setHideExcused(initialHideExcused);
  }, [initialHideExcused]);

  const totalPages = Math.max(1, Math.ceil(totalCount / INTEGRITY_PAGE_SIZE));

  function buildListParams(page: number): URLSearchParams {
    const p = new URLSearchParams();
    if (student.trim()) p.set("student", student.trim());
    if (eventType) p.set("eventType", eventType);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (hideExcused) p.set("hideExcused", "1");
    if (page > 1) p.set("page", String(page));
    return p;
  }

  function applyFilters() {
    router.push(`${integrityPath}?${buildListParams(1).toString()}`);
  }

  function clearFilters() {
    setStudent("");
    setEventType("");
    setFrom("");
    setTo("");
    setHideExcused(false);
    router.push(integrityPath);
  }

  const exportQs = integrityExportSearchParams({
    student: initialStudent,
    eventType: initialEventType,
    fromDate: initialFrom,
    toDate: initialTo,
    hideExcused: initialHideExcused,
  }).toString();
  const exportHref = `${exportApiPath}${exportQs ? `?${exportQs}` : ""}`;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4 dark:border-white/10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="int-student">{t("assessments.integrityFilterStudentLabel")}</Label>
          <Input
            id="int-student"
            value={student}
            onChange={(e) => setStudent(e.target.value)}
            placeholder={t("assessments.integrityFilterStudentPlaceholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="int-event">{t("assessments.integrityFilterEventType")}</Label>
          <select
            id="int-event"
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            <option value="">{t("assessments.integrityFilterAllEventTypes")}</option>
            {INTEGRITY_EVENT_TYPES.map((evt) => (
              <option key={evt} value={evt}>
                {proctorEventTypeLabel(evt, t)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="int-from">{t("assessments.integrityFilterFromUtc")}</Label>
          <Input id="int-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="int-to">{t("assessments.integrityFilterToUtc")}</Label>
          <Input id="int-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideExcused}
              onChange={(e) => setHideExcused(e.target.checked)}
            />
            {t("assessments.integrityHideExcusedHint")}
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => applyFilters()}>
          {t("assessments.applyFilters")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => clearFilters()}>
          {t("assessments.clearFilters")}
        </Button>
        <Link href={exportHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {t("assessments.integrityDownloadTsv")}
        </Link>
        <span className="text-xs text-muted-foreground">
          {totalCount === 1
            ? t("assessments.integrityOneMatchingEvent")
            : t("assessments.integrityNMatchingEvents").replace("%s", String(totalCount))}{" "}
          ·{" "}
          {t("assessments.integrityPageLine")
            .replace("%s", String(currentPage))
            .replace("%s", String(totalPages))}
        </span>
      </div>
    </div>
  );
}
