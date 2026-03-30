"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  suspendedAt: string | null;
};

const ROLES = ["ADMIN", "TEACHER", "STUDENT"] as const;

export function PlatformUserActions({ organizationId, user: u }: { organizationId: string; user: UserRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(u.name ?? "");
  const [role, setRole] = useState(u.role);

  const suspended = Boolean(u.suspendedAt);

  async function setSuspended(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/organizations/${organizationId}/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ suspended: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not update");
        return;
      }
      toast.success(next ? "User suspended" : "User reactivated");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    const payload: Record<string, string> = {};
    if (name.trim() !== (u.name ?? "").trim()) {
      payload.name = name.trim();
    }
    if (role !== u.role) {
      payload.role = role;
    }
    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save");
      setEditing(false);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/platform/organizations/${organizationId}/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not save");
        return;
      }
      toast.success("User updated");
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Permanently delete ${u.email}? This cannot be undone if they still own courses or other required records.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/organizations/${organizationId}/users/${u.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not delete");
        return;
      }
      toast.success("User removed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex min-w-[200px] flex-col items-stretch gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-left dark:border-white/10">
        <div className="space-y-1">
          <Label className="text-xs">Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Role</Label>
          <select
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="h-8" disabled={busy} onClick={() => void saveProfile()}>
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setName(u.name ?? "");
              setRole(u.role);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void setSuspended(!suspended)}>
        {suspended ? "Unsuspend" : "Suspend"}
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditing(true)}>
        Edit
      </Button>
      <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void remove()}>
        Delete
      </Button>
    </div>
  );
}
