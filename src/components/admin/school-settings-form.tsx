"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ORG_THEME_TEMPLATES } from "@/lib/org-branding";

type Org = {
  reportCardsPublished: boolean;
  certificatesPublished: boolean;
  themeTemplate: string;
  customPrimaryHex: string | null;
  customAccentHex: string | null;
  heroImageUrl: string | null;
};

export function SchoolSettingsForm({ slug, initial }: { slug: string; initial: Org }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reportOn, setReportOn] = useState(initial.reportCardsPublished);
  const [certOn, setCertOn] = useState(initial.certificatesPublished);
  const [template, setTemplate] = useState(initial.themeTemplate);
  const [primary, setPrimary] = useState(initial.customPrimaryHex ?? "");
  const [accent, setAccent] = useState(initial.customAccentHex ?? "");
  const [heroUrl, setHeroUrl] = useState(initial.heroImageUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const heroPreview =
    heroUrl.trim() === ""
      ? null
      : /^https?:\/\//i.test(heroUrl.trim())
        ? heroUrl.trim()
        : heroUrl.trim().startsWith("orgs/")
          ? `/api/public/organizations/${slug}/hero`
          : null;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportCardsPublished: reportOn,
          certificatesPublished: certOn,
          themeTemplate: template,
          customPrimaryHex: primary.trim() || null,
          customAccentHex: accent.trim() || null,
          heroImageUrl: heroUrl.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error && typeof data.error === "object"
              ? JSON.stringify(data.error)
              : "Could not save";
        toast.error(msg);
        return;
      }
      toast.success("School settings saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function uploadHero(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/organization/hero", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; heroImageUrl?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      if (data.heroImageUrl) setHeroUrl(data.heroImageUrl);
      toast.success("Hero image uploaded");
      router.refresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Public hero &amp; carousel</h3>
        <div className="space-y-2">
          <Label htmlFor="hero-url">Hero image URL (https)</Label>
          <Input
            id="hero-url"
            type="text"
            placeholder="https://… or leave blank after upload"
            value={heroUrl}
            onChange={(e) => setHeroUrl(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Paste a direct image link, or upload a file below. Uploaded images are stored on this server and shown on the
            platform carousel and public school page (unless the CMS hero override is set).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadHero(f);
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Uploading…" : "Upload from device"}
          </Button>
        </div>
        {heroPreview ? (
          <div className="overflow-hidden rounded-lg border border-border/60 dark:border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroPreview} alt="" className="max-h-48 w-full object-cover" />
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Student visibility</h3>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={reportOn} onChange={(e) => setReportOn(e.target.checked)} className="size-4 rounded border-input" />
          <span>Publish report cards (students see submitted assessment scores)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={certOn} onChange={(e) => setCertOn(e.target.checked)} className="size-4 rounded border-input" />
          <span>Publish completion certificates (students can open certificates when eligible)</span>
        </label>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Theme</h3>
        <div className="space-y-2">
          <Label htmlFor="theme-template">Template</Label>
          <select
            id="theme-template"
            className="flex h-10 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            {ORG_THEME_TEMPLATES.map((t) => (
              <option key={t} value={t}>
                {t === "DEFAULT" ? "Default" : t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Applies primary accents across the school app. Optional hex colors override the template primary and accent.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary-hex">Primary color (#RRGGBB)</Label>
            <Input
              id="primary-hex"
              placeholder="#4f46e5"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              maxLength={7}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accent-hex">Accent color (#RRGGBB)</Label>
            <Input
              id="accent-hex"
              placeholder="#optional"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              maxLength={7}
            />
          </div>
        </div>
      </section>

      <Button type="button" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save school settings"}
      </Button>
    </div>
  );
}
