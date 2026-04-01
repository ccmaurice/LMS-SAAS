"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type DeptOpt = { id: string; name: string; code: string | null; facultyDivisionName: string | null };

export function CourseDepartmentPanel({
  courseId,
  allDepartments,
}: {
  courseId: string;
  allDepartments: DeptOpt[];
}) {
  const router = useRouter();
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/departments`, { credentials: "include" });
      const data = (await res.json()) as { departments?: { id: string }[] };
      setLinkedIds((data.departments ?? []).map((d) => d.id));
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
      const res = await fetch(`/api/courses/${courseId}/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ departmentId: pick }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not link department");
        return;
      }
      toast.success("Department linked");
      setPick("");
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(departmentId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/departments?departmentId=${encodeURIComponent(departmentId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        toast.error("Could not remove link");
        return;
      }
      toast.success("Department unlinked");
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const available = allDepartments.filter((d) => !linkedIds.includes(d.id));

  function deptLabel(d: DeptOpt) {
    const bits = [d.name, d.code, d.facultyDivisionName].filter(Boolean);
    return bits.join(" · ");
  }

  return (
    <div className="surface-bento space-y-4 p-5">
      <div>
        <h2 className="text-lg font-medium">Departments taking this course</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Link academic departments so you can target assessments by department. Students still enroll
          individually; visibility uses department affiliation.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : linkedIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No departments linked yet.</p>
      ) : (
        <ul className="space-y-2">
          {linkedIds.map((id) => {
            const d = allDepartments.find((x) => x.id === id);
            return (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm dark:border-white/10"
              >
                <span>{d ? deptLabel(d) : id}</span>
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
          <Label htmlFor="add-dept">Add department</Label>
          <select
            id="add-dept"
            className="flex h-9 min-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">Choose…</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                {deptLabel(d)}
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
