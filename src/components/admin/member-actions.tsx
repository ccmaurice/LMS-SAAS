"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/generated/prisma/enums";

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  suspendedAt: string | null;
};

export function MemberActions({ member, currentUserId }: { member: Member; currentUserId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name ?? "");
  const [role, setRole] = useState<"TEACHER" | "STUDENT">(
    member.role === "TEACHER" ? "TEACHER" : member.role === "STUDENT" ? "STUDENT" : "STUDENT",
  );
  const [busy, setBusy] = useState(false);

  const isAdmin = member.role === "ADMIN";
  const isSelf = member.id === currentUserId;

  if (isAdmin || isSelf) {
    return isAdmin ? (
      <span className="text-xs text-muted-foreground">—</span>
    ) : (
      <span className="text-xs text-muted-foreground">You</span>
    );
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), role }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      toast.success("Member updated");
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setSuspended(suspended: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ suspended }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not update");
        return;
      }
      toast.success(suspended ? "Account suspended" : "Account reactivated");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Permanently remove ${member.email}? This cannot be undone. If they own courses or assessments, removal may fail.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${member.id}`, { method: "DELETE", credentials: "include" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not remove member");
        return;
      }
      toast.success("Member removed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const suspended = Boolean(member.suspendedAt);

  return (
    <div className="flex min-w-[200px] flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {suspended ? <span className="text-xs font-medium text-destructive">Suspended</span> : null}
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
          {editing ? "Close" : "Edit"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void setSuspended(!suspended)}
        >
          {suspended ? "Unsuspend" : "Suspend"}
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void remove()}>
          Remove
        </Button>
      </div>
      {editing ? (
        <div className="w-full max-w-xs space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3 dark:border-white/10">
          <div className="space-y-1">
            <Label htmlFor={`name-${member.id}`} className="text-xs">
              Display name
            </Label>
            <Input id={`name-${member.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`role-${member.id}`} className="text-xs">
              Role
            </Label>
            <select
              id={`role-${member.id}`}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={role}
              onChange={(e) => setRole(e.target.value as "TEACHER" | "STUDENT")}
            >
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
            </select>
          </div>
          <Button type="button" size="sm" className="w-full" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
