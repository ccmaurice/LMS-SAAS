"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PlatformSignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/platform/logout", { method: "POST", credentials: "include" });
      router.push("/platform/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void signOut()}>
      {loading ? "Signing out…" : "Platform sign out"}
    </Button>
  );
}
