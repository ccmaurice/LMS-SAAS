"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function OrgAssessmentsAttemptsLockPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState<"lock" | "unlock" | null>(null);

  async function run(locked: boolean) {
    const msg = locked
      ? "Lock new attempts on ALL quizzes and exams in this school? Students mid-attempt can still submit."
      : "Unlock new attempts for ALL assessments? Students will be able to start or resume normally.";
    if (!window.confirm(msg)) return;
    setBusy(locked ? "lock" : "unlock");
    try {
      const res = await fetch("/api/admin/assessments-attempts-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locked }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(d.error ?? "Request failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">Quizzes & exams — lock attempts (org-wide)</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Applies to every assessment in every course. Teachers can still lock or unlock individual assessments from the
        course or editor. Locking blocks <span className="font-medium text-foreground">new</span> attempts only;
        anyone already in progress can save and submit.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={busy !== null}
          onClick={() => void run(true)}
        >
          {busy === "lock" ? "Locking…" : "Lock all assessments"}
        </Button>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run(false)}>
          {busy === "unlock" ? "Unlocking…" : "Unlock all assessments"}
        </Button>
      </div>
    </div>
  );
}
