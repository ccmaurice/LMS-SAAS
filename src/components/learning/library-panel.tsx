"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LearningResourceKind } from "@/generated/prisma/enums";
import { ResourcePlayer } from "@/components/learning/resource-player";

type Row = {
  id: string;
  title: string;
  description: string | null;
  kind: LearningResourceKind;
  externalUrl: string | null;
  mimeType: string | null;
  sortOrder: number;
  published: boolean;
  hasFile: boolean;
  createdAt: string;
};

function LibrarySkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-12">
        <Skeleton className="h-52 md:col-span-8" />
        <Skeleton className="h-52 md:col-span-4" />
        <Skeleton className="h-44 md:col-span-4" />
        <Skeleton className="h-44 md:col-span-4" />
        <Skeleton className="h-44 md:col-span-4" />
      </div>
    </div>
  );
}

export function LibraryPanel({ canManage }: { canManage: boolean }) {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<"PDF" | "VIDEO">("PDF");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/learning-resources");
      const data = (await res.json()) as { resources?: Row[] };
      setRows(data.resources ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLink() {
    if (!linkUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Link",
          description: description.trim() || null,
          kind: "LINK",
          externalUrl: linkUrl.trim(),
          published: true,
        }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not add link");
        return;
      }
      setTitle("");
      setDescription("");
      setLinkUrl("");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile() {
    if (!file || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append(
        "meta",
        JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          kind,
        }),
      );
      form.append("file", file);
      const res = await fetch("/api/learning-resources/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      setTitle("");
      setDescription("");
      setFile(null);
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LibrarySkeleton />;
  }

  return (
    <div className="space-y-10">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {canManage ? (
        <div className="grid gap-4 md:grid-cols-12">
          <div className="surface-bento border-dashed border-primary/30 p-6 md:col-span-6 lg:col-span-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add link</h2>
            <p className="mt-1 text-xs text-muted-foreground">YouTube, Mux HLS, or any HTTPS URL.</p>
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resource title" />
              </div>
              <div className="space-y-1">
                <Label>URL</Label>
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
              </div>
              <Button type="button" size="sm" disabled={busy} onClick={() => void createLink()}>
                Add link
              </Button>
            </div>
          </div>

          <div className="surface-bento border-dashed border-primary/30 p-6 md:col-span-6 lg:col-span-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upload file</h2>
            <p className="mt-1 text-xs text-muted-foreground">PDF or video (mp4/webm). Drag a file onto the field or click to pick.</p>
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Description (optional)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={kind === "PDF"} onChange={() => setKind("PDF")} />
                  PDF
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={kind === "VIDEO"} onChange={() => setKind("VIDEO")} />
                  Video
                </label>
              </div>
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-border border-dashed py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/40",
                )}
              >
                <input
                  type="file"
                  accept=".pdf,.mp4,.webm,video/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? file.name : "Drop file or click to upload"}
              </label>
              <Button type="button" size="sm" disabled={busy || !file || !title.trim()} onClick={() => void uploadFile()}>
                Upload
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-12">
        {rows.map((r, i) => (
          <motion.li
            key={r.id}
            className={cn("surface-bento p-5", i === 0 ? "md:col-span-8" : "md:col-span-4")}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30, delay: i * 0.04 }}
            whileHover={reduce ? undefined : { y: -3, transition: { type: "spring", stiffness: 500, damping: 26 } }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold tracking-tight">{r.title}</h3>
                {r.description ? <p className="mt-1 text-sm text-muted-foreground">{r.description}</p> : null}
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{r.kind}</p>
              </div>
            </div>
            <div className="mt-4">
              <ResourcePlayer
                resourceId={r.id}
                kind={r.kind}
                externalUrl={r.externalUrl}
                hasFile={r.hasFile}
                mimeType={r.mimeType}
              />
            </div>
          </motion.li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No resources in the library yet.</p>
      ) : null}
    </div>
  );
}
