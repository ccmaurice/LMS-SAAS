"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProctoringExcuseEventButton({
  assessmentId,
  eventId,
  disabled,
}: {
  assessmentId: string;
  eventId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/proctoring/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventIds: [eventId],
          dismissNote: note.trim() || null,
        }),
      });
      if (!res.ok) return;
      setOpen(false);
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (disabled) return null;

  return (
    <div className="inline-flex flex-col items-end gap-1">
      {!open ? (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
          Excuse
        </Button>
      ) : (
        <div className="flex max-w-[220px] flex-col gap-2 rounded-md border border-border bg-background p-2 text-left dark:border-white/10">
          <Label className="text-xs">Note (optional)</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for record"
            className="h-8 text-xs"
          />
          <div className="flex gap-1">
            <Button type="button" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => void submit()}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setNote("");
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

export function ProctoringExcuseSubmissionButton({
  assessmentId,
  submissionId,
  disabled,
}: {
  assessmentId: string;
  submissionId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/proctoring/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submissionId,
          dismissNote: note.trim() || null,
        }),
      });
      if (!res.ok) return;
      setOpen(false);
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (disabled) return null;

  return (
    <div className="mt-2">
      {!open ? (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
          Excuse integrity for this attempt
        </Button>
      ) : (
        <div className="mt-1 flex max-w-sm flex-col gap-2 rounded-md border border-border bg-muted/20 p-3 dark:border-white/10">
          <p className="text-xs text-muted-foreground">
            Marks all integrity signals for this submission as excused. The log is kept for audit.
          </p>
          <Label className="text-xs">Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for record" />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
              Confirm
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setNote("");
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
