"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function EnrollButton({ courseId, enrolled }: { courseId: string; enrolled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, {
        method: enrolled ? "DELETE" : "POST",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        const msg = d.error ?? "Request failed";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(enrolled ? "Left course" : "Enrolled");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" variant={enrolled ? "outline" : "default"} disabled={loading} onClick={toggle}>
        {loading ? "…" : enrolled ? "Leave course" : "Enroll"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
