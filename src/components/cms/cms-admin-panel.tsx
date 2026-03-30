"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type Entry = { id: string; key: string; value: string; updatedAt: string };

export function CmsAdminPanel({ hidePrefix }: { hidePrefix?: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cms");
      const data = (await res.json()) as { entries?: Entry[]; error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not load CMS");
        return;
      }
      const list = data.entries ?? [];
      setEntries(
        hidePrefix ? list.filter((e) => !e.key.startsWith(hidePrefix)) : list,
      );
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [hidePrefix]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(key: string, value: string) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/cms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = (await res.json()) as { entry?: Entry; error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      if (data.entry) {
        setEntries((prev) => {
          const i = prev.findIndex((e) => e.key === key);
          if (i < 0) return [...prev, data.entry!].sort((a, b) => a.key.localeCompare(b.key));
          const next = [...prev];
          next[i] = data.entry!;
          return next;
        });
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(null);
    }
  }

  async function addNew() {
    const k = newKey.trim();
    if (!k) return;
    await save(k, newValue);
    setNewKey("");
    setNewValue("");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="surface-bento p-6">
        <h2 className="text-lg font-semibold tracking-tight">Add entry</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keys use dots, e.g. <code className="rounded bg-muted px-1">dashboard.welcome</code>. Values update the live app on next request — no redeploy.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nk">Key</Label>
            <Input
              id="nk"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="dashboard.welcome"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nv">Value</Label>
            <Textarea id="nv" value={newValue} onChange={(e) => setNewValue(e.target.value)} rows={3} />
          </div>
        </div>
        <Button type="button" className="mt-4" onClick={() => void addNew()} disabled={!newKey.trim()}>
          Add or update
        </Button>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Existing entries</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <ul className="space-y-6">
            {entries.map((e) => (
              <li key={e.id} className="surface-bento p-5">
                <EntryRow entry={e} disabled={saving === e.key} onSave={(v) => void save(e.key, v)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  onSave,
  disabled,
}: {
  entry: Entry;
  onSave: (value: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState(entry.value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{entry.key}</code>
        <span className="text-xs text-muted-foreground">
          Updated {new Date(entry.updatedAt).toLocaleString()}
        </span>
      </div>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} className="text-sm" />
      <Button type="button" size="sm" disabled={disabled || value === entry.value} onClick={() => onSave(value)}>
        {disabled ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
