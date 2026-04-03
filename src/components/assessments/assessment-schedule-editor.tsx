"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ScheduleEntryClient = {
  id?: string;
  kind: "CA_OPENS" | "CA_DUE" | "EXAM_WINDOW";
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  label: string;
  sortOrder: number;
};

function isoToDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const t = d.getTime() - d.getTimezoneOffset() * 60_000;
  return new Date(t).toISOString().slice(0, 16);
}

function datetimeLocalToIso(s: string): string | null {
  const x = s.trim();
  if (!x) return null;
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function dateOnlyToIsoStart(day: string): string | null {
  if (!day.trim()) return null;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0)).toISOString();
}

function dateOnlyToIsoEnd(day: string): string | null {
  if (!day.trim()) return null;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 23, 59, 59, 999)).toISOString();
}

export function AssessmentScheduleEditor({
  assessmentId,
  initialEntries,
}: {
  assessmentId: string;
  initialEntries: ScheduleEntryClient[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ScheduleEntryClient[]>(() => initialEntries);
  const [busy, setBusy] = useState(false);

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        kind: "CA_DUE",
        startsAt: "",
        endsAt: "",
        allDay: false,
        label: "",
        sortOrder: prev.length,
      },
    ]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i).map((r, j) => ({ ...r, sortOrder: j })));
  }

  async function saveSchedule() {
    const entries: Record<string, unknown>[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i]!;
      let startsAt: string | null = null;
      let endsAt: string | null = null;
      if (r.allDay) {
        if (!r.startsAt.trim()) {
          toast.error(`Row ${i + 1}: start date required when all-day is checked.`);
          return;
        }
        startsAt = dateOnlyToIsoStart(r.startsAt.trim());
        if (r.kind === "EXAM_WINDOW") {
          if (!r.endsAt.trim()) {
            toast.error(`Row ${i + 1}: end date required for exam windows when all-day.`);
            return;
          }
          endsAt = dateOnlyToIsoEnd(r.endsAt.trim());
        }
      } else {
        startsAt = datetimeLocalToIso(r.startsAt);
        if (!startsAt) {
          toast.error(`Row ${i + 1}: valid start date/time required.`);
          return;
        }
        endsAt = datetimeLocalToIso(r.endsAt);
        if (r.kind === "EXAM_WINDOW" && !endsAt) {
          toast.error(`Row ${i + 1}: end date/time required for exam windows.`);
          return;
        }
      }
      entries.push({
        kind: r.kind,
        startsAt,
        endsAt: r.kind === "EXAM_WINDOW" ? endsAt : null,
        allDay: r.allDay,
        label: r.label.trim() || null,
        sortOrder: i,
      });
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/schedule`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = (await res.json()) as { error?: unknown; entries?: ScheduleEntryClient[] };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save schedule");
        return;
      }
      if (data.entries) {
        setRows(
          data.entries.map((e) => ({
            kind: e.kind,
            startsAt: e.allDay ? e.startsAt.slice(0, 10) : isoToDatetimeLocal(e.startsAt),
            endsAt:
              e.kind === "EXAM_WINDOW" && e.endsAt
                ? e.allDay
                  ? e.endsAt.slice(0, 10)
                  : isoToDatetimeLocal(e.endsAt)
                : "",
            allDay: e.allDay,
            label: e.label ?? "",
            sortOrder: e.sortOrder,
          })),
        );
      }
      toast.success("Assessment schedule saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-bento space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Assessment schedule</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Continuous assessment (quiz) open/due times and exam session windows feed the school dashboard calendar and
          in-app reminders. Remove all rows and save to clear the schedule (stored open/due fields on the assessment are
          cleared too).
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No schedule rows yet. Add a row to publish dates to the calendar.</p>
      ) : null}
      <ul className="space-y-4">
        {rows.map((r, i) => (
          <li key={i} className="rounded-lg border border-border/60 p-3 dark:border-white/10">
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Type</span>
                <select
                  className="h-9 min-w-[10rem] rounded-md border border-input bg-background px-2 text-sm"
                  value={r.kind}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, kind: e.target.value as ScheduleEntryClient["kind"] } : x,
                      ),
                    )
                  }
                >
                  <option value="CA_OPENS">CA opens (quiz available)</option>
                  <option value="CA_DUE">CA due (quiz deadline)</option>
                  <option value="EXAM_WINDOW">Exam window (start–end)</option>
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={r.allDay}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, j) => (j === i ? { ...x, allDay: e.target.checked } : x)))
                  }
                />
                All-day
              </label>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeRow(i)}>
                Remove
              </Button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {r.allDay ? (
                <>
                  <div className="space-y-1">
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={r.startsAt.length > 10 ? r.startsAt.slice(0, 10) : r.startsAt}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x, j) => (j === i ? { ...x, startsAt: e.target.value } : x)))
                      }
                    />
                  </div>
                  {r.kind === "EXAM_WINDOW" ? (
                    <div className="space-y-1">
                      <Label>End date</Label>
                      <Input
                        type="date"
                        value={r.endsAt.length > 10 ? r.endsAt.slice(0, 10) : r.endsAt}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x, j) => (j === i ? { ...x, endsAt: e.target.value } : x)))
                        }
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label>Starts</Label>
                    <Input
                      type="datetime-local"
                      value={r.startsAt}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x, j) => (j === i ? { ...x, startsAt: e.target.value } : x)))
                      }
                    />
                  </div>
                  {r.kind === "EXAM_WINDOW" ? (
                    <div className="space-y-1">
                      <Label>Ends</Label>
                      <Input
                        type="datetime-local"
                        value={r.endsAt}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x, j) => (j === i ? { ...x, endsAt: e.target.value } : x)))
                        }
                      />
                    </div>
                  ) : null}
                </>
              )}
              <div className="space-y-1 sm:col-span-2">
                <Label>Custom label on calendar (optional)</Label>
                <Input
                  value={r.label}
                  onChange={(e) =>
                    setRows((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                  placeholder="Overrides default title for this row"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          Add row
        </Button>
        <Button type="button" disabled={busy} onClick={() => void saveSchedule()}>
          Save schedule
        </Button>
      </div>
    </section>
  );
}
