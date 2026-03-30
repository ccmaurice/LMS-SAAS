"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ImpersonateOrgButton({
  organizationId,
  label = "Open org",
}: {
  organizationId: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/platform/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ organizationId }),
      });
      const data = (await res.json()) as { error?: string; organization?: { slug: string } };
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      if (data.organization?.slug) {
        router.push(`/o/${data.organization.slug}/dashboard`);
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" disabled={busy} onClick={() => void run()}>
        {busy ? "Opening…" : label}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
