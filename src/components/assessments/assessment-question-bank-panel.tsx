"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Question } from "@/generated/prisma/client";

type BankItem = {
  id: string;
  framework: string;
  subject: string;
  gradeLabel: string | null;
  standardCode: string | null;
  type: string;
  prompt: string;
  points: number;
};

export function AssessmentQuestionBankPanel({
  assessmentId,
  onAdded,
  disabled,
}: {
  assessmentId: string;
  onAdded: (q: Question) => void;
  disabled?: boolean;
}) {
  const [framework, setFramework] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [items, setItems] = useState<BankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (framework) qs.set("framework", framework);
      if (subject.trim()) qs.set("subject", subject.trim());
      const res = await fetch(`/api/admin/question-bank?${qs}`, { credentials: "include" });
      const data = (await res.json()) as { items?: BankItem[]; error?: string };
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "Could not load question bank");
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setErr("Network error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [framework, subject]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addFromBank(bankItemId: string) {
    setAddingId(bankItemId);
    setErr(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/questions/from-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bankItemId }),
      });
      const data = (await res.json()) as { question?: Question; error?: string };
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "Could not add question");
        return;
      }
      if (data.question) onAdded(data.question);
    } catch {
      setErr("Network error");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-border p-4 dark:border-white/15">
      <p className="text-sm text-muted-foreground">
        Shared curriculum-aligned items (IB, Cambridge, AP). Adding copies a question into this assessment; the bank
        entry is unchanged.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Framework</Label>
          <select
            className="h-9 min-w-[140px] rounded-md border border-input bg-background px-2 text-sm"
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
          >
            <option value="">All</option>
            <option value="IB">IB</option>
            <option value="CAMBRIDGE">Cambridge</option>
            <option value="AP">AP</option>
          </select>
        </div>
        <div className="min-w-[160px] flex-1 space-y-1">
          <Label>Subject contains</Label>
          <Input
            placeholder="e.g. Mathematics"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading bank…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No items match. Run <code className="rounded bg-muted px-1">npm run db:seed</code> once to load the platform
          starter set (20 items), or ask an admin to seed the database.
        </p>
      ) : (
        <ul className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto pr-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex flex-col gap-2 rounded-md border border-border/80 p-3 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {it.framework} · {it.subject}
                  {it.gradeLabel ? ` · ${it.gradeLabel}` : ""}
                  {it.standardCode ? ` · ${it.standardCode}` : ""} · {it.type} · {it.points} pts
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{it.prompt}</p>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                disabled={disabled || addingId !== null}
                onClick={() => void addFromBank(it.id)}
              >
                {addingId === it.id ? "Adding…" : "Add to test"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
