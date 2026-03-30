"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CourseGradingPanel({
  courseId,
  initial,
}: {
  courseId: string;
  initial: {
    gradeWeightContinuous: number;
    gradeWeightExam: number;
    gradingScale: "PERCENTAGE" | "LETTER_AF" | "NUMERIC_10";
  };
}) {
  const router = useRouter();
  const [wCa, setWCa] = useState(String(initial.gradeWeightContinuous));
  const [wEx, setWEx] = useState(String(initial.gradeWeightExam));
  const [scale, setScale] = useState(initial.gradingScale);
  const [busy, setBusy] = useState(false);

  async function save() {
    const ca = Number(wCa);
    const ex = Number(wEx);
    if (Number.isNaN(ca) || Number.isNaN(ex) || Math.abs(ca + ex - 1) > 0.001) {
      toast.error("Continuous + exam weights must sum to 1 (e.g. 0.4 and 0.6).");
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
        }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      toast.success("Grading settings saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-bento space-y-3 p-5">
      <h2 className="text-lg font-semibold">Intelligent gradebook — course weights</h2>
      <p className="text-sm text-muted-foreground">
        Quizzes roll into continuous assessment (CA); exams into the exam bucket. Final semester % ={" "}
        <code className="rounded bg-muted px-1">w_ca × S_ca + w_exam × S_exam</code>. Tag each assessment with a
        semester on its settings page.
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
      </div>
      <Button type="button" disabled={busy} onClick={() => void save()}>
        Save grading settings
      </Button>
    </section>
  );
}
