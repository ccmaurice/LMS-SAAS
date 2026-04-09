"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button-variants";
import { ORG_THEME_TEMPLATES } from "@/lib/org-branding";
import { cn } from "@/lib/utils";
import { STANDARD_4_POINT_GPA_BANDS } from "@/lib/grading_engine/letter-gpa";
import { academicCalendarCopy } from "@/lib/education_context/academic-period-labels";
import { certificateSignatureImageDisplayUrl } from "@/lib/org/certificate-signature-display-url";

type GpaBandRow = { minPercent: number; gpa: number };

type Org = {
  reportCardsPublished: boolean;
  certificatesPublished: boolean;
  themeTemplate: string;
  customPrimaryHex: string | null;
  customAccentHex: string | null;
  heroImageUrl: string | null;
  logoImageUrl: string | null;
  educationLevel: "PRIMARY" | "SECONDARY" | "HIGHER_ED";
  reportShowRank: boolean;
  gpaBands?: GpaBandRow[] | undefined;
  certificateSignerName?: string;
  certificateSignerTitle?: string;
  certificateSignatureImageUrl?: string;
  certificateCompletionPhrase?: string;
};

function sortGpaBandsDesc(bands: GpaBandRow[]): GpaBandRow[] {
  return [...bands].sort((a, b) => b.minPercent - a.minPercent);
}

function parseBandInputs(rows: { min: string; gpa: string }[]): GpaBandRow[] | null {
  const out: GpaBandRow[] = [];
  for (const r of rows) {
    const min = Number(r.min);
    const gpa = Number(r.gpa);
    if (!Number.isFinite(min) || !Number.isFinite(gpa)) return null;
    if (min < 0 || min > 100 || gpa < 0 || gpa > 5) return null;
    out.push({ minPercent: min, gpa });
  }
  if (out.length > 32) return null;
  return sortGpaBandsDesc(out);
}

export function SchoolSettingsForm({ slug, initial }: { slug: string; initial: Org }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const signatureFileRef = useRef<HTMLInputElement>(null);
  const [reportOn, setReportOn] = useState(initial.reportCardsPublished);
  const [certOn, setCertOn] = useState(initial.certificatesPublished);
  const [template, setTemplate] = useState(initial.themeTemplate);
  const [primary, setPrimary] = useState(initial.customPrimaryHex ?? "");
  const [accent, setAccent] = useState(initial.customAccentHex ?? "");
  const [heroUrl, setHeroUrl] = useState(initial.heroImageUrl ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logoImageUrl ?? "");
  const [educationLevel, setEducationLevel] = useState(initial.educationLevel);
  const [reportShowRank, setReportShowRank] = useState(initial.reportShowRank);
  const [gpaBandRows, setGpaBandRows] = useState<{ min: string; gpa: string }[]>(() => {
    const src =
      initial.gpaBands && initial.gpaBands.length > 0 ? initial.gpaBands : [...STANDARD_4_POINT_GPA_BANDS];
    return sortGpaBandsDesc(src).map((b) => ({ min: String(b.minPercent), gpa: String(b.gpa) }));
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [certSignerName, setCertSignerName] = useState(initial.certificateSignerName ?? "");
  const [certSignerTitle, setCertSignerTitle] = useState(initial.certificateSignerTitle ?? "");
  const [certSignatureUrl, setCertSignatureUrl] = useState(initial.certificateSignatureImageUrl ?? "");
  const [certPhrase, setCertPhrase] = useState(initial.certificateCompletionPhrase ?? "");

  const cal = academicCalendarCopy(educationLevel);

  const logoPreview =
    logoUrl.trim() === ""
      ? null
      : /^https?:\/\//i.test(logoUrl.trim())
        ? logoUrl.trim()
        : logoUrl.trim().startsWith("orgs/")
          ? `/api/public/organizations/${slug}/logo`
          : null;

  const heroPreview =
    heroUrl.trim() === ""
      ? null
      : /^https?:\/\//i.test(heroUrl.trim())
        ? heroUrl.trim()
        : heroUrl.trim().startsWith("orgs/")
          ? `/api/public/organizations/${slug}/hero`
          : null;

  const signaturePreview = certificateSignatureImageDisplayUrl(slug, certSignatureUrl);

  async function save() {
    let gpaBandsPayload: GpaBandRow[] | undefined;
    if (educationLevel === "HIGHER_ED") {
      const parsed = parseBandInputs(gpaBandRows);
      if (!parsed) {
        toast.error("GPA bands: enter valid min % (0–100) and GPA (0–5) on each row, up to 32 rows.");
        return;
      }
      gpaBandsPayload = parsed;
    }

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
          logoImageUrl: logoUrl.trim() || null,
          educationLevel,
          organizationSettings: {
            reportShowRank,
            ...(gpaBandsPayload ? { gpaBands: gpaBandsPayload } : {}),
            certificateSignerName: certSignerName.trim(),
            certificateSignerTitle: certSignerTitle.trim(),
            certificateSignatureImageUrl: certSignatureUrl.trim(),
            certificateCompletionPhrase: certPhrase.trim(),
          },
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

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/organization/logo", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; logoImageUrl?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      if (data.logoImageUrl) setLogoUrl(data.logoImageUrl);
      toast.success("Brand logo uploaded from your device");
      router.refresh();
    } finally {
      setUploadingLogo(false);
      if (logoFileRef.current) logoFileRef.current.value = "";
    }
  }

  async function uploadSignature(file: File) {
    setUploadingSignature(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/organization/certificate-signature", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; certificateSignatureImageUrl?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      if (data.certificateSignatureImageUrl) setCertSignatureUrl(data.certificateSignatureImageUrl);
      toast.success("Certificate signature uploaded");
      router.refresh();
    } finally {
      setUploadingSignature(false);
      if (signatureFileRef.current) signatureFileRef.current.value = "";
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
        <h3 className="text-sm font-semibold tracking-tight">School brand logo</h3>
        <p className="text-xs text-muted-foreground">
          Shown in the app sidebar, on transcripts and report cards (including PDFs), on completion certificates, centered on
          your public school page (<code className="rounded bg-muted px-1">/school/your-slug</code>), and as the browser
          tab icon (favicon) for both that page and the signed-in school app. Upload a PNG, JPEG, WebP, or GIF from your
          device, or paste an https image URL. If you leave this empty, the public hero image (or the CMS hero override)
          is used as a fallback where a logo is needed.
        </p>
        <div className="space-y-2">
          <Label htmlFor="logo-url">Logo image URL (optional)</Label>
          <Input
            id="logo-url"
            type="text"
            placeholder="https://… or leave blank after upload"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={logoFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadLogo(f);
            }}
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={uploadingLogo}
            onClick={() => logoFileRef.current?.click()}
          >
            {uploadingLogo ? "Uploading…" : "Upload logo from device"}
          </Button>
        </div>
        {logoPreview ? (
          <div className="flex justify-start overflow-hidden rounded-lg border border-border/60 bg-muted/20 p-4 dark:border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoPreview} alt="" className="max-h-28 w-auto max-w-full object-contain" />
          </div>
        ) : null}
      </section>

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
        <h3 className="text-sm font-semibold tracking-tight">Education context</h3>
        <div className="space-y-2">
          <Label htmlFor="edu-level">Education level</Label>
          <select
            id="edu-level"
            className="flex h-10 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value as typeof educationLevel)}
          >
            <option value="PRIMARY">Primary</option>
            <option value="SECONDARY">Secondary</option>
            <option value="HIGHER_ED">Higher education</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Drives terminology, report card labels, and transcript behavior. For higher education, map course percentages to
            GPA using the table below (first matching row from the top wins). {cal.schoolSettingsBlurb}
          </p>
          <div className="flex max-w-md flex-col gap-2 rounded-lg border border-border/60 p-3 dark:border-white/10 sm:max-w-none sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">Academic calendar</p>
              <p className="text-xs text-muted-foreground">
                Open {cal.navLabel.toLowerCase()} to add or remove {cal.periodPlural}, set codes and labels, and mark the
                current {cal.periodSingular} for students.
              </p>
            </div>
            <Link
              href={`/o/${slug}/admin/terms`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex shrink-0")}
            >
              {cal.navLabel}
            </Link>
          </div>
          {educationLevel === "HIGHER_ED" ? (
            <div className="space-y-3 rounded-lg border border-border/60 p-3 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">GPA bands (min % → GPA)</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setGpaBandRows(
                      sortGpaBandsDesc([...STANDARD_4_POINT_GPA_BANDS]).map((b) => ({
                        min: String(b.minPercent),
                        gpa: String(b.gpa),
                      })),
                    )
                  }
                >
                  Reset to standard 4.0
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Higher percent thresholds first. Example: 93+ → 4.0, then 90+ → 3.7, down to 0+ → 0.
              </p>
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {gpaBandRows.map((row, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-8 text-muted-foreground tabular-nums">{i + 1}.</span>
                    <Label className="sr-only" htmlFor={`gpa-min-${i}`}>
                      Min %
                    </Label>
                    <Input
                      id={`gpa-min-${i}`}
                      className="w-24 font-mono text-xs"
                      inputMode="decimal"
                      value={row.min}
                      onChange={(e) => {
                        const next = [...gpaBandRows];
                        next[i] = { ...next[i], min: e.target.value };
                        setGpaBandRows(next);
                      }}
                    />
                    <span className="text-muted-foreground">% min →</span>
                    <Label className="sr-only" htmlFor={`gpa-val-${i}`}>
                      GPA
                    </Label>
                    <Input
                      id={`gpa-val-${i}`}
                      className="w-20 font-mono text-xs"
                      inputMode="decimal"
                      value={row.gpa}
                      onChange={(e) => {
                        const next = [...gpaBandRows];
                        next[i] = { ...next[i], gpa: e.target.value };
                        setGpaBandRows(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={gpaBandRows.length <= 1}
                      onClick={() => setGpaBandRows(gpaBandRows.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={gpaBandRows.length >= 32}
                onClick={() => setGpaBandRows([...gpaBandRows, { min: "0", gpa: "0" }])}
              >
                Add row
              </Button>
            </div>
          ) : null}
          {educationLevel === "PRIMARY" ? (
            <p className="text-xs text-muted-foreground">
              Primary: configure <span className="font-medium text-foreground">Classes &amp; homerooms</span> and terms so
              learners see their class and current term on Settings.
            </p>
          ) : null}
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={reportShowRank}
            onChange={(e) => setReportShowRank(e.target.checked)}
            className="size-4 rounded border-input"
          />
          <span>Show class rank on generated reports (when reporting engine has rank data)</span>
        </label>
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
        <h3 className="text-sm font-semibold tracking-tight">Completion certificate</h3>
        <p className="text-xs text-muted-foreground">
          Shown on the printed / PDF completion certificate: formal layout with optional handwritten signature image, printed
          signatory name and title, and a verification QR code. Leave fields blank to fall back to the school name and
          &quot;School administrator&quot; under the signature line.
        </p>
        <div className="space-y-2">
          <Label htmlFor="cert-phrase">Completion sentence (between learner name and course title)</Label>
          <Input
            id="cert-phrase"
            placeholder='e.g. has successfully completed the course'
            value={certPhrase}
            onChange={(e) => setCertPhrase(e.target.value)}
            maxLength={280}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cert-signer-name">Signatory printed name</Label>
          <Input
            id="cert-signer-name"
            placeholder="e.g. Jane Smith"
            value={certSignerName}
            onChange={(e) => setCertSignerName(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cert-signer-title">Signatory title</Label>
          <Input
            id="cert-signer-title"
            placeholder='e.g. Principal, or "Senior Director, Programs"'
            value={certSignerTitle}
            onChange={(e) => setCertSignerTitle(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cert-signature-url">Signature image URL (optional)</Label>
          <Input
            id="cert-signature-url"
            placeholder="https://… (PNG with transparent background works best)"
            value={certSignatureUrl}
            onChange={(e) => setCertSignatureUrl(e.target.value)}
            maxLength={2000}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={signatureFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadSignature(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingSignature}
              onClick={() => signatureFileRef.current?.click()}
            >
              {uploadingSignature ? "Uploading…" : "Upload signature from device"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Upload stores the image on this server (or your configured blob store) and fills the field with the file
            reference. You can still paste an external https image URL instead. If set, this image appears above the
            signature line; otherwise the signatory name is shown in script when a name is provided.
          </p>
          {signaturePreview ? (
            <div className="overflow-hidden rounded-lg border border-border/60 bg-white p-3 dark:border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signaturePreview} alt="" className="mx-auto max-h-24 object-contain" />
            </div>
          ) : null}
        </div>
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
