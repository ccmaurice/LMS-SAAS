"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Option = { id: string; label: string };

export function ParentLinkForm({ parents, students }: { parents: Option[]; students: Option[] }) {
  const router = useRouter();
  const [parentId, setParentId] = useState(parents[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parentId || !studentId) {
      toast.error("Choose a parent and a student");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/parent-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ parentUserId: parentId, studentUserId: studentId }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not create link");
        return;
      }
      toast.success("Parent linked to student");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (parents.length === 0 || students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add at least one parent and one student (via invites or existing accounts) before linking.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="surface-bento space-y-4 p-5">
      <div>
        <h2 className="text-lg font-medium">Link parent to student</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Parents can then view the linked student&apos;s report card, transcript, assessments, and completion
          certificates when those features are published.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="parent-link-parent">Parent</Label>
          <select
            id="parent-link-parent"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="parent-link-student">Student</Label>
          <select
            id="parent-link-student"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Create link"}
      </Button>
    </form>
  );
}
