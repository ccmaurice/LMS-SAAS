"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function MarkLessonCompleteButton({ lessonId, completed }: { lessonId: string; completed: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function mark() {
    setLoading(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/complete`, { method: "POST" });
      if (res.ok) {
        toast.success("Lesson marked complete");
        router.refresh();
      } else {
        toast.error("Could not update progress");
      }
    } finally {
      setLoading(false);
    }
  }

  if (completed) {
    return (
      <p className="text-sm font-medium text-muted-foreground">
        Completed — progress updated on the course.
      </p>
    );
  }

  return (
    <Button type="button" disabled={loading} onClick={mark}>
      {loading ? "Saving…" : "Mark lesson complete"}
    </Button>
  );
}
