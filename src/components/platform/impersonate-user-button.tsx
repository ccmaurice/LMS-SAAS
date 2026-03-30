"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ImpersonateUserButton({
  organizationId,
  userId,
  orgSlug,
}: {
  organizationId: string;
  userId: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ organizationId, userId }),
      });
      if (!res.ok) return;
      router.push(`/o/${orgSlug}/dashboard`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void run()}>
      {busy ? "…" : "Sign in as"}
    </Button>
  );
}
