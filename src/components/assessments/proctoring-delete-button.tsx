"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ProctoringDeleteEventButton({
  assessmentId,
  eventId,
}: {
  assessmentId: string;
  eventId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!confirm("Are you sure you want to delete this integrity log? This action is permanent.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/proctoring/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
        }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete log");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred deleting log");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className="h-7 text-[10px] font-bold"
      disabled={busy}
      onClick={() => void submit()}
    >
      Delete
    </Button>
  );
}

export function ProctoringClearAllButton({
  assessmentId,
}: {
  assessmentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!confirm("WARNING: Are you sure you want to clear ALL integrity logs for this exam? This action is permanent and cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/proctoring/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clearAll: true,
        }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to clear logs");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred clearing logs");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className="font-bold text-xs shadow-md"
      disabled={busy}
      onClick={() => void submit()}
    >
      Clear All Logs
    </Button>
  );
}
