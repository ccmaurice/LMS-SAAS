"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const KINDS = [
  { v: "RESUMPTION", label: "Resumption" },
  { v: "CLOSURE", label: "Closure" },
  { v: "HOLIDAY", label: "Holiday" },
  { v: "EVENT", label: "Event" },
  { v: "ACTIVITY", label: "Activity" },
  { v: "OTHER", label: "Other" },
] as const;

type Row = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
};

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const t = d.getTime() - d.getTimezoneOffset() * 60_000;
  return new Date(t).toISOString().slice(0, 16);
}

function isoDateOnly(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function fromDateInputs(allDay: boolean, start: string, end: string): { startsAt: string; endsAt: string | null } {
  if (allDay) {
    if (!start.trim()) throw new Error("Start date required");
    const [y, m, d] = start.split("-").map(Number);
    const s = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0, 0));
    let e: Date | null = null;
    if (end.trim()) {
      const [y2, m2, d2] = end.split("-").map(Number);
      e = new Date(Date.UTC(y2!, m2! - 1, d2!, 12, 0, 0, 0));
    }
    return {
      startsAt: s.toISOString(),
      endsAt: e ? e.toISOString() : null,
    };
  }
  if (!start.trim()) throw new Error("Start date/time required");
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) throw new Error("Invalid start");
  let e: Date | null = null;
  if (end.trim()) {
    e = new Date(end);
    if (Number.isNaN(e.getTime())) throw new Error("Invalid end");
  }
  return { startsAt: s.toISOString(), endsAt: e ? e.toISOString() : null };
}

export function SchoolCalendarAdminPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<string>("EVENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startDt, setStartDt] = useState("");
  const [endDt, setEndDt] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/school-calendar", { credentials: "include" });
    const data = (await res.json()) as { events?: Row[] };
    if (!res.ok) {
      toast.error("Could not load calendar");
      return;
    }
    setRows(data.events ?? []);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  function resetForm() {
    setKind("EVENT");
    setTitle("");
    setDescription("");
    setAllDay(true);
    setStartDate("");
    setEndDate("");
    setStartDt("");
    setEndDt("");
    setEditingId(null);
  }

  async function submitCreate() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    let dates: { startsAt: string; endsAt: string | null };
    try {
      dates = fromDateInputs(
        allDay,
        allDay ? startDate : startDt,
        allDay ? endDate : endDt,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid dates");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/school-calendar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          description: description.trim() || null,
          allDay,
          startsAt: dates.startsAt,
          endsAt: dates.endsAt,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        toast.error(typeof d.error === "string" ? d.error : "Create failed");
        return;
      }
      resetForm();
      await load();
      toast.success("Event added");
    } finally {
      setBusy(false);
    }
  }

  async function submitUpdate() {
    if (!editingId) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    let dates: { startsAt: string; endsAt: string | null };
    try {
      dates = fromDateInputs(
        allDay,
        allDay ? startDate : startDt,
        allDay ? endDate : endDt,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid dates");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/school-calendar/${editingId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          description: description.trim() || null,
          allDay,
          startsAt: dates.startsAt,
          endsAt: dates.endsAt,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        toast.error(typeof d.error === "string" ? d.error : "Update failed");
        return;
      }
      resetForm();
      await load();
      toast.success("Event updated");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(r: Row) {
    setEditingId(r.id);
    setKind(r.kind);
    setTitle(r.title);
    setDescription(r.description ?? "");
    setAllDay(r.allDay);
    if (r.allDay) {
      setStartDate(isoDateOnly(r.startsAt));
      setEndDate(r.endsAt ? isoDateOnly(r.endsAt) : "");
      setStartDt("");
      setEndDt("");
    } else {
      setStartDate("");
      setEndDate("");
      setStartDt(isoToDatetimeLocal(r.startsAt));
      setEndDt(r.endsAt ? isoToDatetimeLocal(r.endsAt) : "");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this calendar entry?")) return;
    const res = await fetch(`/api/admin/school-calendar/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    if (editingId === id) resetForm();
    await load();
    toast.success("Deleted");
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <section className="surface-bento space-y-4 p-5">
        <h2 className="text-lg font-semibold">{editingId ? "Edit entry" : "Add entry"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Kind</Label>
            <select
              className="h-9 w-full max-w-md rounded-md border border-input bg-background px-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((k) => (
                <option key={k.v} value={k.v}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. First day of term" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            All-day (use date only)
          </label>
          {allDay ? (
            <>
              <div className="space-y-1">
                <Label>Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>End date (optional)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Starts</Label>
                <Input type="datetime-local" value={startDt} onChange={(e) => setStartDt(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Ends (optional)</Label>
                <Input type="datetime-local" value={endDt} onChange={(e) => setEndDt(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {editingId ? (
            <>
              <Button type="button" disabled={busy} onClick={() => void submitUpdate()}>
                Save changes
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => resetForm()}>
                Cancel edit
              </Button>
            </>
          ) : (
            <Button type="button" disabled={busy} onClick={() => void submitCreate()}>
              Add to calendar
            </Button>
          )}
        </div>
      </section>

      <section className="surface-table-wrap">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3 no-print w-[180px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-xs">{r.kind}</td>
                <td className="px-4 py-3 font-medium">{r.title}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(r.startsAt).toLocaleString()}
                  {r.endsAt ? ` — ${new Date(r.endsAt).toLocaleString()}` : ""}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => void remove(r.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No school-wide events yet.</p> : null}
      </section>
    </div>
  );
}
