"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function PlatformLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/platform";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/platform/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        const err = data.error;
        let msg: string;
        if (typeof err === "string") {
          msg = err;
        } else if (err && typeof err === "object") {
          msg = JSON.stringify(err);
        } else {
          msg = "Could not sign in. Check platform credentials and server configuration.";
        }
        setError(msg);
        return;
      }
      const target = redirectTo.startsWith("/platform") ? redirectTo : "/platform";
      router.push(target);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="surface-glass w-full max-w-md border-0 ring-0">
      <CardHeader>
        <CardTitle>Platform operator</CardTitle>
        <CardDescription>Cross-tenant console. Not for school staff or students.</CardDescription>
      </CardHeader>
      <form onSubmit={(e) => void onSubmit(e)}>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="p-email">Email</Label>
            <Input
              id="p-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-password">Password</Label>
            <Input
              id="p-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Home
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
