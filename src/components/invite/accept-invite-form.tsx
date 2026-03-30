"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcceptInviteForm({
  token,
  email,
  orgName,
  orgSlug,
}: {
  token: string;
  email: string;
  orgName: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          password,
          name: name.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string | Record<string, string[]> };
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error
              ? Object.values(data.error).flat().join(" ")
              : "Could not accept invite";
        setError(msg);
        return;
      }
      router.replace(`/o/${orgSlug}/dashboard`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <p>
          <span className="text-muted-foreground">Organization:</span> {orgName}
        </p>
        <p className="mt-1">
          <span className="text-muted-foreground">Email:</span> {email}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Creating account…" : "Join organization"}
      </Button>
    </form>
  );
}
