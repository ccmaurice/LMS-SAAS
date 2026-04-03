"use client";

import { useCallback, useEffect, useState } from "react";
import type { EducationLevel } from "@/generated/prisma/enums";
import { academicCalendarCopy } from "@/lib/education_context/academic-period-labels";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Term = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isCurrent: boolean;
  startDate: string | null;
  endDate: string | null;
};

function isoDateSlice(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function localDateToStartIso(day: string): string {
  return new Date(`${day.trim()}T00:00:00`).toISOString();
}

function localDateToEndIso(day: string): string {
  return new Date(`${day.trim()}T23:59:59.999`).toISOString();
}

export function AcademicTermsPanel({ educationLevel }: { educationLevel: EducationLevel }) {
  const copy = academicCalendarCopy(educationLevel);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/academic-terms", { credentials: "include" });
    const data = (await res.json()) as { terms?: Term[] };
    if (!res.ok) {
      toast.error("Could not load");
      return;
    }
    setTerms(data.terms ?? []);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  async function createTerm() {
    if (!code.trim() || !label.trim()) {
      toast.error("Code and label are required");
      return;
    }
    const body: Record<string, unknown> = {
      code: code.trim(),
      label: label.trim(),
    };
    if (sortOrder.trim() !== "") {
      const n = Number.parseInt(sortOrder.trim(), 10);
      if (!Number.isFinite(n)) {
        toast.error("Sort order must be a whole number");
        return;
      }
      body.sortOrder = n;
    }
    if (startDate.trim()) body.startDate = localDateToStartIso(startDate.trim());
    if (endDate.trim()) body.endDate = localDateToEndIso(endDate.trim());

    setBusy(true);
    try {
      const res = await fetch("/api/admin/academic-terms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        toast.error(typeof d.error === "string" ? d.error : "Create failed");
        return;
      }
      setCode("");
      setLabel("");
      setSortOrder("");
      setStartDate("");
      setEndDate("");
      await load();
      toast.success(`${copy.periodSingularCapitalized} created`);
    } finally {
      setBusy(false);
    }
  }

  async function setCurrent(id: string) {
    const res = await fetch(`/api/admin/academic-terms/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCurrent: true }),
    });
    if (!res.ok) {
      toast.error("Could not update");
      return;
    }
    await load();
    toast.success(`Current ${copy.periodSingular} updated`);
  }

  async function patchTerm(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/academic-terms/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      toast.error("Update failed");
      return;
    }
    await load();
  }

  async function remove(id: string) {
    if (
      !confirm(
        `Delete this ${copy.periodSingular}? Courses linked to it will have their ${copy.periodSingular} cleared.`,
      )
    )
      return;
    const res = await fetch(`/api/admin/academic-terms/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    await load();
    toast.success(`${copy.periodSingularCapitalized} deleted`);
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading {copy.periodPlural}…</p>;
  }

  const addTitle = `Add ${copy.periodSingular}`;
  const createLabel = `Create ${copy.periodSingular}`;

  return (
    <div className="space-y-8">
      <section className="surface-bento space-y-3 p-5">
        <h2 className="text-lg font-semibold">{addTitle}</h2>
        <p className="text-sm text-muted-foreground">
          Use a short code (e.g. <code className="rounded bg-muted px-1">2025-fall</code>) and a display label. Mark one as{" "}
          <span className="font-medium text-foreground">current</span> so it appears on student settings. Sort order and
          optional dates help transcript “{copy.periodSingular} range” ordering (earlier start dates first).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="2025-fall" />
          </div>
          <div className="space-y-1">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Fall 2025" />
          </div>
          <div className="space-y-1">
            <Label>Sort order</Label>
            <Input
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1">
            <Label>Start date (optional)</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>End date (optional)</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <Button type="button" disabled={busy} onClick={() => void createTerm()}>
          {createLabel}
        </Button>
      </section>

      <section className="surface-table-wrap">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3 w-24">Sort</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Current</th>
              <th className="px-4 py-3 no-print w-[200px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                <td className="px-4 py-3">{t.label}</td>
                <td className="px-4 py-3">
                  <Input
                    className="h-8 w-20 font-mono text-xs"
                    type="number"
                    defaultValue={t.sortOrder}
                    key={`${t.id}-${t.sortOrder}`}
                    onBlur={(e) => {
                      const v = Number.parseInt(e.target.value, 10);
                      if (!Number.isFinite(v) || v === t.sortOrder) return;
                      void patchTerm(t.id, { sortOrder: v });
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {isoDateSlice(t.startDate) || "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {isoDateSlice(t.endDate) || "—"}
                </td>
                <td className="px-4 py-3">{t.isCurrent ? "Yes" : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {!t.isCurrent ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => void setCurrent(t.id)}>
                        Set current
                      </Button>
                    ) : null}
                    <Button type="button" variant="destructive" size="sm" onClick={() => void remove(t.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {terms.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No {copy.periodPlural} yet.</p>
        ) : null}
      </section>
    </div>
  );
}
