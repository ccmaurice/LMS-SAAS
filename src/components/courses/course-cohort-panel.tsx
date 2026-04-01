"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type CohortOpt = { id: string; name: string; gradeLabel: string | null; academicYearLabel: string };

export function CourseCohortPanel({
  courseId,
  allCohorts,
}: {
  courseId: string;
  allCohorts: CohortOpt[];
}) {
  const router = useRouter();
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/cohorts`, { credentials: "include" });
      const data = (await res.json()) as { cohorts?: { id: string }[] };
      setLinkedIds((data.cohorts ?? []).map((c) => c.id));
    } catch {
      setLinkedIds([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!pick) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/cohorts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cohortId: pick }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not link class");
        return;
      }
      toast.success("Class linked");
      setPick("");
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(cohortId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/cohorts?cohortId=${encodeURIComponent(cohortId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error("Could not remove link");
        return;
      }
      toast.success("Class unlinked");
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const available = allCohorts.filter((c) => !linkedIds.includes(c.id));

  return (
    <div className="surface-bento space-y-4 p-5">
      <div>
        <h2 className="text-lg font-medium">Classes taking this course</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Link homeroom classes so teachers can assign assessments to specific groups. Students still enroll
          individually; targeting uses class membership.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : linkedIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No classes linked yet.</p>
      ) : (
        <ul className="space-y-2">
          {linkedIds.map((id) => {
            const c = allCohorts.find((x) => x.id === id);
            return (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm dark:border-white/10"
              >
                <span>
                  {c?.name ?? id}
                  {c?.gradeLabel ? ` · ${c.gradeLabel}` : ""}
                  {c?.academicYearLabel ? ` (${c.academicYearLabel})` : ""}
                </span>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove(id)}>
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="add-cohort">Add class</Label>
          <select
            id="add-cohort"
            className="flex h-9 min-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">Choose…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.academicYearLabel ? ` (${c.academicYearLabel})` : ""}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" disabled={busy || !pick} onClick={() => void add()}>
          Link
        </Button>
      </div>
    </div>
  );
}
