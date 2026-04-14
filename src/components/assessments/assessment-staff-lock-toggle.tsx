"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";

export function AssessmentStaffLockToggle({
  assessmentId,
  initialLocked,
}: {
  assessmentId: string;
  initialLocked: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [locked, setLocked] = useState(initialLocked);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocked(initialLocked);
  }, [initialLocked]);

  async function patch(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ studentAttemptsLocked: next }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(d.error ?? t("assessments.lockUpdateFailed"));
        return;
      }
      setLocked(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={locked ? "border-amber-500/50 text-amber-950 dark:text-amber-100" : undefined}
      disabled={busy}
      onClick={() => void patch(!locked)}
    >
      {busy ? "…" : locked ? t("assessments.unlockAttempts") : t("assessments.lockAttempts")}
    </Button>
  );
}
