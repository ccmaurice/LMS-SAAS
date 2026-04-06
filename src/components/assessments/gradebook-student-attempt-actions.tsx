"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GradebookGrantExtraAttempt({
  assessmentId,
  studentUserId,
  fromSubmissionId,
}: {
  assessmentId: string;
  studentUserId: string;
  /** Optional link to the attempt this grant follows (audit). */
  fromSubmissionId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/retake-grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: studentUserId,
          staffNote: note.trim() || null,
          fromSubmissionId: fromSubmissionId ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not grant attempt");
        return;
      }
      setOpen(false);
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      {!open ? (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
          Grant extra attempt
        </Button>
      ) : (
        <div className="max-w-sm space-y-2 rounded-md border border-border bg-muted/20 p-3 text-left dark:border-white/10">
          <p className="text-xs text-muted-foreground">
            Lets this student start one more session when they have used all allowed tries (same for quizzes and
            exams). Optional note is stored on the retake record.
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Staff note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason" className="h-8 text-sm" />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
              Grant
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setNote("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function GradebookDiscardDraftButton({
  submissionId,
  disabled,
}: {
  submissionId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function discard() {
    if (!window.confirm("Delete this in-progress draft? The student can start again if attempts allow.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/discard-draft`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (disabled) return null;

  return (
    <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => void discard()}>
      Discard draft
    </Button>
  );
}
