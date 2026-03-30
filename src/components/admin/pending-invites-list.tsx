"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type InviteRow = {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

function inviteUrl(token: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") || "";
  return `${base || (typeof window !== "undefined" ? window.location.origin : "")}/invite/${token}`;
}

export function PendingInvitesList({ invites }: { invites: InviteRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function revoke(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/invites/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function copy(token: string, id: string) {
    const url = inviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  if (invites.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending invites.</p>;
  }

  return (
    <ul className="space-y-2">
      {invites.map((inv) => {
        const expired = new Date(inv.expiresAt) <= new Date();
        return (
          <li
            key={inv.id}
            className="surface-bento flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{inv.email}</p>
              <p className="text-xs text-muted-foreground">
                <Badge variant="secondary" className="mr-2 align-middle">
                  {inv.role}
                </Badge>
                {expired ? (
                  <span className="text-destructive">Expired</span>
                ) : (
                  <>Expires {new Date(inv.expiresAt).toLocaleString()}</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void copy(inv.token, inv.id)}>
                {copied === inv.id ? "Copied" : "Copy link"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy === inv.id}
                onClick={() => void revoke(inv.id)}
              >
                Revoke
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
