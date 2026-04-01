"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
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
  canEdit?: boolean;
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

function LibraryResourceCard({
  r,
  reduce,
  onUpdated,
  itemIndex,
}: {
  r: Row;
  reduce: boolean;
  onUpdated: () => Promise<void>;
  itemIndex: number;
}) {
  const canEdit = r.canEdit === true;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [etitle, setEtitle] = useState(r.title);
  const [edesc, setEdesc] = useState(r.description ?? "");
  const [eurl, setEurl] = useState(r.externalUrl ?? "");
  const [epub, setEpub] = useState(r.published);

  useEffect(() => {
    if (!editing) {
      setEtitle(r.title);
      setEdesc(r.description ?? "");
      setEurl(r.externalUrl ?? "");
      setEpub(r.published);
    }
  }, [r, editing]);

  async function save() {
    setBusy(true);
    setLocalError(null);
    try {
      const body: Record<string, unknown> = {
        title: etitle.trim(),
        description: edesc.trim() || null,
        published: epub,
      };
      if (r.kind === "LINK") {
        const u = eurl.trim();
        body.externalUrl = u.length > 0 ? u : null;
      }
      const res = await fetch(`/api/learning-resources/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        setLocalError(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      setEditing(false);
      await onUpdated();
    } catch {
      setLocalError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove “${r.title}” from the library? This cannot be undone.`)) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/learning-resources/${r.id}`, { method: "DELETE", credentials: "include" });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        setLocalError(typeof data.error === "string" ? data.error : "Could not delete");
        return;
      }
      await onUpdated();
    } catch {
      setLocalError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.li
      className="surface-bento p-5"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, delay: reduce ? 0 : itemIndex * 0.04 }}
      whileHover={reduce ? undefined : { y: -3, transition: { type: "spring", stiffness: 500, damping: 26 } }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold tracking-tight">{r.title}</h3>
            {!r.published ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Draft
              </Badge>
            ) : null}
          </div>
          {r.description ? <p className="mt-1 text-sm text-muted-foreground">{r.description}</p> : null}
          <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{r.kind}</p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {!editing ? (
              <>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  Delete
                </Button>
              </>
            ) : (
              <>
                <Button type="button" size="sm" disabled={busy || !etitle.trim()} onClick={() => void save()}>
                  Save
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
      {localError ? <p className="mt-2 text-sm text-destructive">{localError}</p> : null}
      {editing ? (
        <div className="mt-4 space-y-3 border-t border-border/80 pt-4 dark:border-white/10">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={etitle} onChange={(e) => setEtitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={edesc} onChange={(e) => setEdesc(e.target.value)} rows={2} />
          </div>
          {r.kind === "LINK" ? (
            <div className="space-y-1">
              <Label>URL</Label>
              <Input value={eurl} onChange={(e) => setEurl(e.target.value)} placeholder="https://…" />
            </div>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="rounded border-input" checked={epub} onChange={(e) => setEpub(e.target.checked)} />
            Published (visible to students and parents)
          </label>
        </div>
      ) : null}
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
  );
}

export function LibraryPanel({ canManage }: { canManage: boolean }) {
  const reduce = useReducedMotion() ?? false;
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
      const res = await fetch("/api/learning-resources", { credentials: "include" });
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
        credentials: "include",
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
        credentials: "include",
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
            <h2 className="section-heading tracking-wide">Add link</h2>
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
            <h2 className="section-heading tracking-wide">Upload file</h2>
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
          <div key={r.id} className={cn(i === 0 ? "md:col-span-8" : "md:col-span-4")}>
            <LibraryResourceCard r={r} reduce={reduce} onUpdated={load} itemIndex={i} />
          </div>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No resources in the library yet.</p>
      ) : null}
    </div>
  );
}
