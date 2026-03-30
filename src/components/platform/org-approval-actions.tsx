"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function OrgApprovalActions({
  organizationId,
  status,
}: {
  organizationId: string;
  status: "PENDING" | "ACTIVE" | "REJECTED";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status !== "PENDING") {
    return null;
  }

  async function decide(decision: "approve" | "reject") {
    setError(null);
    setLoading(decision);
    try {
      const res = await fetch(`/api/platform/organizations/${organizationId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-4 dark:border-white/10">
      <p className="text-sm font-medium">This school is pending approval</p>
      <p className="text-xs text-muted-foreground">
        Approve to allow staff to sign in and appear on the public directory. Reject to block access.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={loading !== null}
          onClick={() => void decide("approve")}
        >
          {loading === "approve" ? "Approving…" : "Approve school"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={loading !== null}
          onClick={() => void decide("reject")}
        >
          {loading === "reject" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
