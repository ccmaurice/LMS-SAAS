"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StudentRetakePanel({
  assessmentId,
  submissionId,
  retakeRequiresApproval,
  completedAttempts,
  maxAttemptsPerStudent,
  initialPending,
  initialLastDeniedNote,
}: {
  assessmentId: string;
  submissionId: string;
  retakeRequiresApproval: boolean;
  completedAttempts: number;
  maxAttemptsPerStudent: number;
  initialPending: boolean;
  initialLastDeniedNote: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const atCap = completedAttempts >= maxAttemptsPerStudent;

  async function requestRetake() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/retake-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fromSubmissionId: submissionId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "Request failed");
        return;
      }
      setPending(true);
      setMsg("Request sent. Your teacher will review it.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!retakeRequiresApproval) {
    if (!atCap) {
      return (
        <p className="text-sm text-muted-foreground">
          You can start another attempt from the assessment list (up to {maxAttemptsPerStudent} submitted attempt
          {maxAttemptsPerStudent === 1 ? "" : "s"}).
        </p>
      );
    }
    return (
      <p className="text-sm text-muted-foreground">
        You have used all {maxAttemptsPerStudent} allowed attempt{maxAttemptsPerStudent === 1 ? "" : "s"} for this
        activity.
      </p>
    );
  }

  if (atCap && pending) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Retake request pending</p>
        <p className="mt-1 text-muted-foreground">A teacher or admin needs to approve before you can try again.</p>
      </div>
    );
  }

  if (atCap) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4 dark:border-white/10">
        <p className="text-sm text-muted-foreground">
          You have submitted {completedAttempts} time{completedAttempts === 1 ? "" : "s"} (limit {maxAttemptsPerStudent}
          ). Ask your instructor for another attempt.
        </p>
        {initialLastDeniedNote ? (
          <p className="text-sm text-destructive">Last request was denied. {initialLastDeniedNote}</p>
        ) : null}
        <Button type="button" size="sm" disabled={busy} onClick={() => void requestRetake()}>
          {busy ? "Sending…" : "Request retake"}
        </Button>
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Need another try? You still have built-in attempts left — open the assessment again from the list.
    </p>
  );
}
