"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EducationLevel } from "@/generated/prisma/enums";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n/i18n-provider";

export type TermOption = { id: string; label: string };

export function CourseGradingPanel({
  courseId,
  initial,
  terms,
  educationLevel,
}: {
  courseId: string;
  educationLevel: EducationLevel;
  initial: {
    gradeWeightContinuous: number;
    gradeWeightExam: number;
    gradingScale: "PERCENTAGE" | "LETTER_AF" | "NUMERIC_10";
    creditHours: number | null;
    academicTermId: string | null;
  };
  terms: TermOption[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const isHe = educationLevel === "HIGHER_ED";
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
      toast.error(t("courses.grading.toastWeightsSum"));
      return;
    }
    const cr = credits.trim() === "" ? null : Number(credits);
    if (cr != null && (Number.isNaN(cr) || cr < 0)) {
      toast.error(t("courses.grading.toastCreditsInvalid"));
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
        toast.error(typeof data.error === "string" ? data.error : t("courses.grading.toastSaveFailed"));
        return;
      }
      toast.success(t("courses.grading.toastSaved"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-bento space-y-3 p-5">
      <h2 className="text-lg font-semibold">{t("courses.grading.sectionTitle")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("courses.grading.introRollups")}{" "}
        {t("courses.grading.introTranscriptsPrefix")}{" "}
        <span className="font-medium text-foreground">{t("courses.grading.creditHoursHighlight")}</span>{" "}
        {t("courses.grading.introTranscriptsMiddle")}{" "}
        <span className="font-medium text-foreground">
          {isHe ? t("courses.grading.periodHighlightSemester") : t("courses.grading.periodHighlightTerm")}
        </span>{" "}
        ({isHe ? t("courses.grading.adminLinkSemesters") : t("courses.grading.adminLinkTerms")}).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("courses.grading.caWeight")}</Label>
          <Input value={wCa} onChange={(e) => setWCa(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{t("courses.grading.examWeight")}</Label>
          <Input value={wEx} onChange={(e) => setWEx(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>{t("courses.grading.displayScale")}</Label>
          <select
            className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm"
            value={scale}
            onChange={(e) => setScale(e.target.value as typeof scale)}
          >
            <option value="PERCENTAGE">{t("courses.grading.scalePercentage")}</option>
            <option value="LETTER_AF">{t("courses.grading.scaleLetter")}</option>
            <option value="NUMERIC_10">{t("courses.grading.scaleNumeric")}</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>{t("courses.grading.creditHours")}</Label>
          <Input
            placeholder={t("courses.grading.creditPlaceholder")}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1">
          <Label>{isHe ? t("courses.grading.periodLabelSemester") : t("courses.grading.periodLabelTerm")}</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
          >
            <option value="">{t("courses.grading.termNone")}</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="button" disabled={busy} onClick={() => void save()}>
        {busy ? t("courses.grading.saving") : t("courses.grading.save")}
      </Button>
    </section>
  );
}
