"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type TermOption = { id: string; label: string };

export function CourseGradingPanel({
  courseId,
  initial,
  terms,
}: {
  courseId: string;
  initial: {
    gradeWeightContinuous: number;
    gradeWeightExam: number;
    gradingScale: "PERCENTAGE" | "LETTER_AF" | "NUMERIC_10";
    creditHours: number | null;
    academicTermId: string | null;
  };
  terms: TermOption[];
}) {
  const router = useRouter();
  const [wCa, setWCa] = useState(String(initial.gradeWeightContinuous));
  const [wEx, setWEx] = useState(String(initial.gradeWeightExam));
  const [scale, setScale] = useState(initial.gradingScale);
  const [credits, setCredits] = useState(initial.creditHours != null ? String(initial.creditHours) : "");
  const [termId, setTermId] = useState(initial.academicTermId ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    const ca = Number(wCa);
    const ex = Number(wEx);
    if (Number.isNaN(ca) || Number.isNaN(ex) || Math.abs(ca + ex - 1) > 0.001) {
      toast.error("Continuous + exam weights must sum to 1 (e.g. 0.4 and 0.6).");
      return;
    }
    const cr = credits.trim() === "" ? null : Number(credits);
    if (cr != null && (Number.isNaN(cr) || cr < 0)) {
      toast.error("Credit hours must be a non-negative number.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          gradeWeightContinuous: ca,
          gradeWeightExam: ex,
          gradingScale: scale,
          creditHours: cr,
          academicTermId: termId === "" ? null : termId,
        }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      toast.success("Course grading & transcript fields saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-bento space-y-3 p-5">
      <h2 className="text-lg font-semibold">Grades, weights & transcript</h2>
      <p className="text-sm text-muted-foreground">
        Quizzes roll into continuous assessment (CA); exams into the exam bucket. Tag assessments with semester 1–3 for
        rollups. For higher-ed transcripts, set <span className="font-medium text-foreground">credit hours</span> and
        optionally an <span className="font-medium text-foreground">academic term</span> (Admin → Academic terms).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>CA weight (quizzes)</Label>
          <Input value={wCa} onChange={(e) => setWCa(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Exam weight</Label>
          <Input value={wEx} onChange={(e) => setWEx(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Display scale</Label>
          <select
            className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm"
            value={scale}
            onChange={(e) => setScale(e.target.value as typeof scale)}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="LETTER_AF">Letter A–F</option>
            <option value="NUMERIC_10">Numeric /10</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Credit hours (transcript / GPA)</Label>
          <Input
            placeholder="e.g. 3"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1">
          <Label>Academic term</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
          >
            <option value="">— None —</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="button" disabled={busy} onClick={() => void save()}>
        Save
      </Button>
    </section>
  );
}
