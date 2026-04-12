"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_LANDING, type LandingFeature } from "@/lib/platform/landing-defaults";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type Initial = {
  kicker: string;
  headline: string;
  subheadline: string;
  features: LandingFeature[];
  logoRaw: string;
  logoPreviewUrl: string | null;
  faviconRaw: string;
  faviconPreviewUrl: string | null;
};

export function PlatformLandingEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const faviconFileRef = useRef<HTMLInputElement>(null);
  const [kicker, setKicker] = useState(initial.kicker);
  const [headline, setHeadline] = useState(initial.headline);
  const [subheadline, setSubheadline] = useState(initial.subheadline);
  const [features, setFeatures] = useState<LandingFeature[]>(
    initial.features.length > 0 ? initial.features : DEFAULT_LANDING.features,
  );
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(initial.logoPreviewUrl);
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState(initial.faviconPreviewUrl);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  async function saveCopy() {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/landing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kicker,
          headline,
          subheadline,
          features,
        }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      toast.success("Landing page saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clearFavicon() {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/landing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clearFavicon: true }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: unknown };
        toast.error(typeof data.error === "string" ? data.error : "Could not clear favicon");
        return;
      }
      setFaviconPreviewUrl(null);
      toast.success("Favicon removed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clearLogo() {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/landing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clearLogo: true }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: unknown };
        toast.error(typeof data.error === "string" ? data.error : "Could not clear logo");
        return;
      }
      setLogoPreviewUrl(null);
      toast.success("Logo removed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resetDefaults() {
    if (!window.confirm("Replace all landing copy and feature cards with built-in defaults? Logo is not changed.")) {
      return;
    }
    setKicker(DEFAULT_LANDING.kicker);
    setHeadline(DEFAULT_LANDING.headline);
    setSubheadline(DEFAULT_LANDING.subheadline);
    setFeatures(DEFAULT_LANDING.features);
    setBusy(true);
    try {
      const res = await fetch("/api/platform/landing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kicker: DEFAULT_LANDING.kicker,
          headline: DEFAULT_LANDING.headline,
          subheadline: DEFAULT_LANDING.subheadline,
          features: DEFAULT_LANDING.features,
        }),
      });
      if (!res.ok) {
        toast.error("Reset failed");
        return;
      }
      toast.success("Restored default copy");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function uploadFavicon(file: File) {
    setUploadingFavicon(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/platform/landing/favicon", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; previewUrl?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      if (data.previewUrl) setFaviconPreviewUrl(data.previewUrl);
      toast.success("Favicon uploaded");
      router.refresh();
    } finally {
      setUploadingFavicon(false);
      if (faviconFileRef.current) faviconFileRef.current.value = "";
    }
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/platform/landing/logo", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; previewUrl?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      if (data.previewUrl) setLogoPreviewUrl(data.previewUrl);
      toast.success("Logo uploaded");
      router.refresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function updateFeature(i: number, patch: Partial<LandingFeature>) {
    setFeatures((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }

  function addFeature() {
    setFeatures((prev) => [...prev, { title: "New", body: "Description", span: "md:col-span-1" }]);
  }

  function removeFeature(i: number) {
    setFeatures((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/platform" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-muted-foreground")}>
            ← Platform console
          </Link>
          <h1 className="page-title mt-4">Marketing landing page</h1>
          <p className="mt-1 text-muted-foreground">
            Controls the public home page (<code className="rounded bg-muted px-1">/</code>). Upload a{" "}
            <strong className="font-medium text-foreground">site favicon</strong> separately for browser tabs site-wide; the hero
            logo is only for the landing layout.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Open site
          </Link>
        </div>
      </div>

      <section className="surface-bento space-y-4 p-6">
        <h2 className="text-lg font-semibold tracking-tight">Site favicon (browser tab)</h2>
        <p className="text-sm text-muted-foreground">
          Used as the tab icon across the whole app (except school workspaces, which use the school logo when set). Upload
          from your device: PNG, ICO, SVG, WebP, JPEG, or GIF — square 32–512 px recommended; max 512 KB.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={faviconFileRef}
            type="file"
            accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/jpeg,image/webp,image/gif,.ico"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFavicon(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadingFavicon}
            onClick={() => faviconFileRef.current?.click()}
          >
            {uploadingFavicon ? "Uploading…" : "Upload favicon"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || !faviconPreviewUrl}
            onClick={() => void clearFavicon()}
          >
            Remove favicon
          </Button>
        </div>
        {faviconPreviewUrl ? (
          <div className="flex items-center gap-4 rounded-lg border border-border/60 p-4 dark:border-white/10">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40 dark:border-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={faviconPreviewUrl} alt="" className="max-h-10 max-w-10 object-contain" />
            </div>
            <p className="text-xs text-muted-foreground">
              Preview at tab size. Clear your browser favicon cache if you don&apos;t see the update immediately.
            </p>
          </div>
        ) : null}
      </section>

      <section className="surface-bento space-y-4 p-6">
        <h2 className="text-lg font-semibold tracking-tight">Landing hero logo</h2>
        <p className="text-sm text-muted-foreground">
          Shown centered above the kicker on the public home page only. Does not replace the site favicon unless no favicon is
          uploaded (then the logo is used as a fallback tab icon). Max 2 MB.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadLogo(f);
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Uploading…" : "Upload logo"}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy || !logoPreviewUrl} onClick={() => void clearLogo()}>
            Remove logo
          </Button>
        </div>
        {logoPreviewUrl ? (
          <div className="flex justify-center rounded-lg border border-border/60 p-6 dark:border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoPreviewUrl} alt="" className="max-h-24 w-auto object-contain" />
          </div>
        ) : null}
      </section>

      <section className="surface-bento space-y-4 p-6">
        <h2 className="text-lg font-semibold tracking-tight">Hero copy</h2>
        <div className="space-y-2">
          <Label htmlFor="kicker">Kicker (small line above headline)</Label>
          <Input id="kicker" value={kicker} onChange={(e) => setKicker(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub">Subheadline</Label>
          <Textarea id="sub" rows={3} value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
        </div>
      </section>

      <section className="surface-bento space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Feature cards</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => addFeature()}>
            Add card
          </Button>
        </div>
        <ul className="space-y-4">
          {features.map((f, i) => (
            <li key={i} className="space-y-2 rounded-lg border border-border/50 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Card {i + 1}</span>
                <Button type="button" variant="ghost" size="sm" disabled={features.length <= 1} onClick={() => removeFeature(i)}>
                  Remove
                </Button>
              </div>
              <Input placeholder="Title" value={f.title} onChange={(e) => updateFeature(i, { title: e.target.value })} />
              <Textarea
                placeholder="Body"
                rows={2}
                value={f.body}
                onChange={(e) => updateFeature(i, { body: e.target.value })}
              />
              <div className="space-y-1">
                <Label className="text-xs">Grid span (Tailwind)</Label>
                <Input
                  className="font-mono text-xs"
                  value={f.span}
                  onChange={(e) => updateFeature(i, { span: e.target.value })}
                  placeholder="md:col-span-1"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={busy} onClick={() => void saveCopy()}>
          {busy ? "Saving…" : "Save landing copy"}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void resetDefaults()}>
          Reset copy to defaults
        </Button>
      </div>
    </div>
  );
}
