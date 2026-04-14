"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewAssessmentForm({ courseId, orgSlug }: { courseId: string; orgSlug: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, description: description || undefined, published }),
      });
      const data = (await res.json()) as { error?: unknown; assessment?: { id: string } };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("assessments.createFailedShort"));
        return;
      }
      if (data.assessment?.id) {
        router.push(`/o/${orgSlug}/courses/${courseId}/assessments/${data.assessment.id}/edit`);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-1">
        <Label htmlFor="t">{t("courses.fieldTitle")}</Label>
        <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="d">{t("courses.fieldDescription")}</Label>
        <Textarea id="d" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t("courses.published")}
      </label>
      <Button type="submit" disabled={loading}>
        {loading ? t("courses.creating") : t("assessments.createAndEditQuestions")}
      </Button>
    </form>
  );
}
