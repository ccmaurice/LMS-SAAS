"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_SCHOOL_PUBLIC_EXTRA_CARDS,
  SCHOOL_PUBLIC_EXTRA_CARDS_KEY,
  type SchoolPublicExtraCard,
  parseSchoolPublicExtraCards,
} from "@/lib/school-public";
import { youtubeEmbedSrc } from "@/lib/youtube";

function newCard(): SchoolPublicExtraCard {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`,
    title: "New section",
    body: "",
    imageUrl: "",
    videoUrl: "",
  };
}

function CardAssetUploader({
  kind,
  disabled,
  onDone,
}: {
  kind: "publicCardImage" | "publicCardVideo";
  disabled: boolean;
  onDone: (storageKey: string) => void;
}) {
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
      const data = (await res.json()) as { error?: string; value?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      if (data.value) {
        onDone(data.value);
        toast.success(kind === "publicCardImage" ? "Image uploaded for this card" : "Video uploaded for this card");
      }
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  const accept =
    kind === "publicCardImage" ? "image/jpeg,image/png,image/webp,image/gif" : "video/mp4,video/webm";

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
        {uploading ? "Uploading…" : kind === "publicCardImage" ? "Upload image" : "Upload video (MP4/WebM)"}
      </Button>
      <span className="text-xs text-muted-foreground">Stored securely; URL field fills with the file key.</span>
    </div>
  );
}

function cardImagePreview(slug: string, imageUrl: string): string | null {
  const v = imageUrl.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("orgs/")) {
    return `/api/public/organizations/${slug}/card-media?type=image&key=${encodeURIComponent(v)}`;
  }
  return null;
}

function cardVideoPreview(slug: string, videoUrl: string): { youtube: string | null; file: string | null } {
  const v = videoUrl.trim();
  if (!v) return { youtube: null, file: null };
  const yt = youtubeEmbedSrc(v);
  if (yt) return { youtube: yt, file: null };
  if (/^https?:\/\//i.test(v) && /\.(mp4|webm)(\?|$)/i.test(v)) return { youtube: null, file: v };
  if (v.startsWith("orgs/")) {
    return {
      youtube: null,
      file: `/api/public/organizations/${slug}/card-media?type=video&key=${encodeURIComponent(v)}`,
    };
  }
  return { youtube: null, file: null };
}

export function SchoolPublicExtraCardsEditor({ slug, initialJson }: { slug: string; initialJson: string }) {
  const router = useRouter();
  const seeded = useMemo(() => parseSchoolPublicExtraCards(initialJson), [initialJson]);
  const [cards, setCards] = useState<SchoolPublicExtraCard[]>(() => seeded);
  const [saving, setSaving] = useState(false);

  const seedKey = initialJson;
  useEffect(() => {
    setCards(parseSchoolPublicExtraCards(seedKey));
  }, [seedKey]);

  async function saveAll() {
    const json = JSON.stringify(cards);
    if (json.length > 49_000) {
      toast.error("Too much content — shorten text or remove a card (limit ~50k per CMS field).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/cms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key: SCHOOL_PUBLIC_EXTRA_CARDS_KEY, value: json }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      toast.success("Custom sections saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= cards.length) return;
    setCards((prev) => {
      const next = [...prev];
      const t = next[i]!;
      next[i] = next[j]!;
      next[j] = t;
      return next;
    });
  }

  return (
    <div className="surface-bento space-y-6 border-t border-border/60 p-6 dark:border-white/10">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Extra sections (custom cards)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add, remove, and reorder sections on your public school page. Each card can include text, an image (URL or
          upload), and a video (YouTube, direct .mp4/.webm link, or upload). They appear after Contact, in list order.
          Standard sections (Admissions, About, Gallery, Contact) stay in the CMS fields above.
        </p>
        <code className="mt-2 inline-block rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {SCHOOL_PUBLIC_EXTRA_CARDS_KEY}
        </code>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom sections yet. Click &quot;Add section&quot; to create one.</p>
      ) : null}

      <ul className="space-y-8">
        {cards.map((card, i) => {
          const imgPrev = cardImagePreview(slug, card.imageUrl);
          const vidPrev = cardVideoPreview(slug, card.videoUrl);
          return (
            <li
              key={card.id}
              className="space-y-3 rounded-lg border border-border/60 p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Section {i + 1}</span>
                <div className="flex flex-wrap gap-1">
                  <Button type="button" variant="outline" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={i === cards.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (!confirm("Remove this section?")) return;
                      setCards((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Section title (required)</Label>
                <Input
                  value={card.title}
                  onChange={(e) =>
                    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, title: e.target.value } : c)))
                  }
                  maxLength={200}
                />
              </div>
              <div className="space-y-1">
                <Label>Body text</Label>
                <Textarea
                  rows={5}
                  value={card.body}
                  onChange={(e) =>
                    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, body: e.target.value } : c)))
                  }
                  placeholder="Paragraphs separated by blank lines"
                />
              </div>
              <div className="space-y-1">
                <Label>Image URL (optional)</Label>
                <Input
                  className="font-mono text-sm"
                  placeholder="https://… or leave blank after upload"
                  value={card.imageUrl}
                  onChange={(e) =>
                    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, imageUrl: e.target.value } : c)))
                  }
                />
                <CardAssetUploader
                  kind="publicCardImage"
                  disabled={saving}
                  onDone={(value) =>
                    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, imageUrl: value } : c)))
                  }
                />
                {imgPrev ? (
                  <div className="overflow-hidden rounded-lg border border-border/60 dark:border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgPrev} alt="" className="max-h-48 w-full object-contain" />
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label>Video — YouTube URL, .mp4/.webm link, or upload</Label>
                <Input
                  className="font-mono text-sm"
                  placeholder="https://youtube.com/… or video URL"
                  value={card.videoUrl}
                  onChange={(e) =>
                    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, videoUrl: e.target.value } : c)))
                  }
                />
                <CardAssetUploader
                  kind="publicCardVideo"
                  disabled={saving}
                  onDone={(value) =>
                    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, videoUrl: value } : c)))
                  }
                />
                {vidPrev.youtube ? (
                  <div className="aspect-video max-h-52 w-full overflow-hidden rounded-lg border border-border/60 dark:border-white/10">
                    <iframe title="Preview" src={vidPrev.youtube} className="h-full w-full" allowFullScreen />
                  </div>
                ) : vidPrev.file ? (
                  <video
                    className="max-h-48 w-full rounded-lg border border-border/60 dark:border-white/10"
                    controls
                    preload="metadata"
                    src={vidPrev.file}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={saving || cards.length >= MAX_SCHOOL_PUBLIC_EXTRA_CARDS}
          onClick={() => setCards((prev) => [...prev, newCard()])}
        >
          Add section
        </Button>
        <Button type="button" disabled={saving} onClick={() => void saveAll()}>
          {saving ? "Saving…" : "Save all custom sections"}
        </Button>
      </div>
    </div>
  );
}
