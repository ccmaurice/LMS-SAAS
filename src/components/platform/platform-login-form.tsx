"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n/i18n-provider";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function PlatformLoginForm() {
  const { t } = useI18n();
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
          msg = t("platform.loginErrorGeneric");
        }
        setError(msg);
        return;
      }
      const target = redirectTo.startsWith("/platform") ? redirectTo : "/platform";
      router.push(target);
      router.refresh();
    } catch {
      setError(t("platform.loginNetworkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="auth-card-shell surface-glass w-full max-w-md border-0 shadow-none ring-1 ring-border/40 dark:ring-white/10">
      <CardHeader className="space-y-1">
        <CardTitle className="page-title">{t("platform.operator")}</CardTitle>
        <CardDescription className="text-pretty leading-relaxed">{t("platform.loginDescription")}</CardDescription>
      </CardHeader>
      <form onSubmit={(e) => void onSubmit(e)}>
        <CardContent className="space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/15"
            >
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="p-email">{t("auth.email")}</Label>
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
            <Label htmlFor="p-password">{t("auth.password")}</Label>
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
            {t("nav.home")}
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? t("auth.signingIn") : t("auth.signInButton")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
