"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SchoolPublicExtraCardsEditor } from "@/components/cms/school-public-extra-cards-editor";
import { SCHOOL_PUBLIC_CMS_KEYS, SCHOOL_PUBLIC_EXTRA_CARDS_KEY } from "@/lib/school-public";
import { youtubeEmbedSrc } from "@/lib/youtube";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

function CmsAssetUploader({
  slug,
  kind,
  disabled,
  onDone,
}: {
  slug: string;
  kind: "cmsHero" | "aboutVideo";
  disabled: boolean;
  onDone: (value: string) => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPick(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await fetch("/api/admin/cms/org-asset", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; value?: string; previewUrl?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      if (data.value) {
        onDone(data.value);
        toast.success(kind === "cmsHero" ? "Hero image uploaded" : "Video uploaded");
        router.refresh();
      }
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  const accept = kind === "cmsHero" ? "image/jpeg,image/png,image/webp,image/gif" : "video/mp4,video/webm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => ref.current?.click()}>
        {uploading ? "Uploading…" : kind === "cmsHero" ? "Upload image" : "Upload video (MP4/WebM)"}
      </Button>
      <span className="text-xs text-muted-foreground">Serves from /api/public/organizations/{slug}/…</span>
    </div>
  );
}

export function SchoolPublicCmsSection({
  slug,
  initialValues,
}: {
  slug: string;
  initialValues: Record<string, string>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initialValues }));
  const [saving, setSaving] = useState<string | null>(null);

  const initialSeed = JSON.stringify(initialValues);
  useEffect(() => {
    const base = JSON.parse(initialSeed) as Record<string, string>;
    setValues((prev) => ({ ...base, ...prev }));
  }, [initialSeed]);

  async function saveKey(key: string, value: string) {
    setSaving(key);
    try {
      const res = await fetch("/api/admin/cms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key, value }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      toast.success("Saved");
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="surface-bento space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Public school page</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One-page site: hero, admissions, about us (with optional video), gallery, and contact. Default hero image:
            <strong className="text-foreground"> Admin → School settings</strong>. CMS can override the hero image for this
            page only.
          </p>
        </div>
        <Link href={`/school/${slug}`} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Preview public page
        </Link>
      </div>

      <ul className="space-y-8">
        {SCHOOL_PUBLIC_CMS_KEYS.map((field) => {
          const v = values[field.key] ?? "";
          const initial = initialValues[field.key] ?? "";
          const cmsHeroPreview =
            field.key === "school.public.hero.imageUrl"
              ? !v.trim()
                ? null
                : /^https?:\/\//i.test(v.trim())
                  ? v.trim()
                  : v.trim().startsWith("orgs/")
                    ? `/api/public/organizations/${slug}/cms-hero`
                    : null
              : null;
          const aboutYoutubeEmbed =
            field.key === "school.public.about.videoUrl" && v.trim() ? youtubeEmbedSrc(v) : null;
          const aboutVideoFilePreview =
            field.key === "school.public.about.videoUrl"
              ? !v.trim()
                ? null
                : /^https?:\/\//i.test(v.trim()) && /\.(mp4|webm)(\?|$)/i.test(v.trim())
                  ? v.trim()
                  : v.trim().startsWith("orgs/")
                    ? `/api/public/organizations/${slug}/about-video`
                    : null
              : null;

          return (
            <li key={field.key} className="space-y-2 border-t border-border/50 pt-6 first:border-t-0 first:pt-0 dark:border-white/10">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label htmlFor={field.key} className="text-base font-medium">
                  {field.label}
                </Label>
                <code className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{field.key}</code>
              </div>
              <p className="text-xs text-muted-foreground">{field.hint}</p>
              {field.assetUpload ? (
                <CmsAssetUploader
                  slug={slug}
                  kind={field.assetUpload}
                  disabled={saving === field.key}
                  onDone={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
                />
              ) : null}
              <Textarea
                id={field.key}
                value={v}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                rows={field.rows}
                className="text-sm"
              />
              {cmsHeroPreview ? (
                <div className="overflow-hidden rounded-lg border border-border/60 dark:border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cmsHeroPreview} alt="" className="max-h-40 w-full object-cover" />
                </div>
              ) : null}
              {aboutYoutubeEmbed ? (
                <div className="aspect-video max-h-52 w-full overflow-hidden rounded-lg border border-border/60 dark:border-white/10">
                  <iframe title="Video preview" src={aboutYoutubeEmbed} className="h-full w-full" allowFullScreen />
                </div>
              ) : aboutVideoFilePreview ? (
                <video
                  className="max-h-48 w-full rounded-lg border border-border/60 dark:border-white/10"
                  controls
                  preload="metadata"
                  src={aboutVideoFilePreview}
                />
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={saving === field.key || v === initial}
                onClick={() => void saveKey(field.key, v)}
              >
                {saving === field.key ? "Saving…" : "Save this field"}
              </Button>
            </li>
          );
        })}
      </ul>

      <SchoolPublicExtraCardsEditor slug={slug} initialJson={values[SCHOOL_PUBLIC_EXTRA_CARDS_KEY] ?? ""} />
    </div>
  );
}
