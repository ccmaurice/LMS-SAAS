"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Row = {
  id: string;
  status: string;
  studentNote: string | null;
  staffNote: string | null;
  createdAt: string;
  consumedAt: string | null;
  user: { id: string; name: string | null; email: string };
};

export function GradebookRetakeRequests({ assessmentId }: { assessmentId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/retake-requests`, { credentials: "include" });
      const data = (await res.json()) as { requests?: Row[] };
      setRows(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string, status: "APPROVED" | "DENIED") {
    setBusyId(id);
    try {
      const staffNote = notes[id]?.trim() || undefined;
      const res = await fetch(`/api/assessments/${assessmentId}/retake-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, staffNote }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = rows.filter((r) => r.status === "PENDING");

  if (loading) return <p className="text-sm text-muted-foreground">Loading retake requests…</p>;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card/30 p-4 dark:border-white/10">
      <h2 className="text-lg font-semibold">Retake requests</h2>
      <p className="text-xs text-muted-foreground">
        Approve student requests here, or use <strong>Grant extra attempt</strong> on a gradebook row to add an
        approved retake without a student request (quizzes and exams).
      </p>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending requests.</p>
      ) : (
        <ul className="space-y-4">
          {pending.map((r) => (
            <li key={r.id} className="rounded-lg border border-border/80 p-3 dark:border-white/10">
              <p className="text-sm font-medium">
                {r.user.name?.trim() || r.user.email}
                <span className="ml-2 font-normal text-muted-foreground">{r.user.email}</span>
              </p>
              {r.studentNote ? (
                <p className="mt-1 text-sm text-muted-foreground">Student note: {r.studentNote}</p>
              ) : null}
              <Textarea
                className="mt-2 text-sm"
                rows={2}
                placeholder="Optional note to student (shown if denied)"
                value={notes[r.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === r.id}
                  onClick={() => void resolve(r.id, "APPROVED")}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyId === r.id}
                  onClick={() => void resolve(r.id, "DENIED")}
                >
                  Deny
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.some((r) => r.status !== "PENDING") ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Recent history</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {rows
              .filter((r) => r.status !== "PENDING")
              .map((r) => (
                <li key={r.id}>
                  {r.user.email} · {r.status}
                  {r.consumedAt ? " · used" : ""}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
