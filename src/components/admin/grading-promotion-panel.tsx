"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Initial = {
  academicYearLabel: string;
  promotionPassMinPercent: number;
  promotionProbationMinPercent: number;
};

export function GradingPromotionPanel({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [year, setYear] = useState(initial.academicYearLabel);
  const [passMin, setPassMin] = useState(String(initial.promotionPassMinPercent));
  const [probMin, setProbMin] = useState(String(initial.promotionProbationMinPercent));
  const [busy, setBusy] = useState(false);
  const [recomputeBusy, setRecomputeBusy] = useState(false);

  async function savePolicy() {
    const p = Number(passMin);
    const pr = Number(probMin);
    if (Number.isNaN(p) || Number.isNaN(pr) || pr > p) {
      toast.error("Probation minimum must be ≤ pass minimum (both 0–100).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          academicYearLabel: year.trim(),
          promotionPassMinPercent: p,
          promotionProbationMinPercent: pr,
        }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      toast.success("Grading policy saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function recompute() {
    setRecomputeBusy(true);
    try {
      const res = await fetch("/api/admin/promotion/recompute", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; studentsUpdated?: number };
      if (!res.ok) {
        toast.error(data.error ?? "Recompute failed");
        return;
      }
      toast.success(`Promotion snapshots updated for ${data.studentsUpdated ?? 0} students.`);
      router.refresh();
    } finally {
      setRecomputeBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Academic year &amp; promotion</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tag assessments with semester 1–3 and set course CA/exam weights. Cumulative averages use graded submissions
          only. Recompute after changing thresholds or semester tags.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ay">Academic year label</Label>
          <Input id="ay" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025-2026" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pass">Pass — cumulative % ≥</Label>
          <Input id="pass" type="number" min={0} max={100} value={passMin} onChange={(e) => setPassMin(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="prob">Probation — cumulative % ≥ (below pass)</Label>
          <Input id="prob" type="number" min={0} max={100} value={probMin} onChange={(e) => setProbMin(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void savePolicy()}>
          Save policy
        </Button>
        <Button type="button" variant="secondary" disabled={recomputeBusy} onClick={() => void recompute()}>
          {recomputeBusy ? "Recomputing…" : "Recompute promotion snapshots"}
        </Button>
      </div>
    </div>
  );
}
