"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INTEGRITY_EVENT_TYPES, integrityExportSearchParams } from "@/lib/assessments/integrity-query";
import { proctorEventTypeLabel } from "@/lib/assessments/proctoring-summary";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import Link from "next/link";

const PAGE_SIZE = 50;

export function IntegrityLogFilters({
  integrityPath,
  exportApiPath,
  initialStudent,
  initialEventType,
  initialFrom,
  initialTo,
  currentPage,
  totalCount,
}: {
  integrityPath: string;
  exportApiPath: string;
  initialStudent: string;
  initialEventType: string;
  initialFrom: string;
  initialTo: string;
  currentPage: number;
  totalCount: number;
}) {
  const router = useRouter();
  const [student, setStudent] = useState(initialStudent);
  const [eventType, setEventType] = useState(initialEventType);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function buildListParams(page: number): URLSearchParams {
    const p = new URLSearchParams();
    if (student.trim()) p.set("student", student.trim());
    if (eventType) p.set("eventType", eventType);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
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
    router.push(integrityPath);
  }

  const exportQs = integrityExportSearchParams({
    student: initialStudent,
    eventType: initialEventType,
    fromDate: initialFrom,
    toDate: initialTo,
  }).toString();
  const exportHref = `${exportApiPath}${exportQs ? `?${exportQs}` : ""}`;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4 dark:border-white/10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="int-student">Student (name or email contains)</Label>
          <Input
            id="int-student"
            value={student}
            onChange={(e) => setStudent(e.target.value)}
            placeholder="Search…"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="int-event">Event type</Label>
          <select
            id="int-event"
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            <option value="">All types</option>
            {INTEGRITY_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {proctorEventTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="int-from">From (UTC date)</Label>
          <Input id="int-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="int-to">To (UTC date)</Label>
          <Input id="int-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => applyFilters()}>
          Apply filters
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => clearFilters()}>
          Clear
        </Button>
        <Link href={exportHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Download TSV (filtered, max 15k)
        </Link>
        <span className="text-xs text-muted-foreground">
          {totalCount} matching event{totalCount === 1 ? "" : "s"} · page {currentPage} of {totalPages}
        </span>
      </div>
    </div>
  );
}

export const INTEGRITY_PAGE_SIZE = PAGE_SIZE;
