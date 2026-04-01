"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Term = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isCurrent: boolean;
  startDate: string | null;
  endDate: string | null;
};

export function AcademicTermsPanel() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/academic-terms", { credentials: "include" });
    const data = (await res.json()) as { terms?: Term[] };
    if (!res.ok) {
      toast.error("Could not load terms");
      return;
    }
    setTerms(data.terms ?? []);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  async function createTerm() {
    if (!code.trim() || !label.trim()) {
      toast.error("Code and label are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/academic-terms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), label: label.trim() }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        toast.error(typeof d.error === "string" ? d.error : "Create failed");
        return;
      }
      setCode("");
      setLabel("");
      await load();
      toast.success("Term created");
    } finally {
      setBusy(false);
    }
  }

  async function setCurrent(id: string) {
    const res = await fetch(`/api/admin/academic-terms/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCurrent: true }),
    });
    if (!res.ok) {
      toast.error("Could not update");
      return;
    }
    await load();
    toast.success("Current term updated");
  }

  async function remove(id: string) {
    if (!confirm("Delete this term? Courses linked to it will have term cleared.")) return;
    const res = await fetch(`/api/admin/academic-terms/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    await load();
    toast.success("Term deleted");
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading terms…</p>;
  }

  return (
    <div className="space-y-8">
      <section className="surface-bento space-y-3 p-5">
        <h2 className="text-lg font-semibold">Add term</h2>
        <p className="text-sm text-muted-foreground">
          Use a short code (e.g. <code className="rounded bg-muted px-1">2025-fall</code>) and a display label. Mark one
          term as <span className="font-medium text-foreground">current</span> so it appears on student settings.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="2025-fall" />
          </div>
          <div className="space-y-1">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Fall 2025" />
          </div>
        </div>
        <Button type="button" disabled={busy} onClick={() => void createTerm()}>
          Create term
        </Button>
      </section>

      <section className="surface-table-wrap">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Current</th>
              <th className="px-4 py-3 no-print w-[200px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                <td className="px-4 py-3">{t.label}</td>
                <td className="px-4 py-3">{t.isCurrent ? "Yes" : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {!t.isCurrent ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => void setCurrent(t.id)}>
                        Set current
                      </Button>
                    ) : null}
                    <Button type="button" variant="destructive" size="sm" onClick={() => void remove(t.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {terms.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No terms yet.</p> : null}
      </section>
    </div>
  );
}
