"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n/i18n-provider";
import { isValidOrgSlug, normalizeOrgSlug } from "@/lib/slug";

function formatApiError(data: { error?: unknown; message?: unknown }, t: (key: string) => string): string {
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  const e = data.error;
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object" && !Array.isArray(e)) {
    const o = e as { fieldErrors?: Record<string, string[] | unknown>; formErrors?: string[] };
    if (o.fieldErrors && typeof o.fieldErrors === "object") {
      const parts: string[] = [];
      for (const [key, val] of Object.entries(o.fieldErrors)) {
        if (Array.isArray(val)) parts.push(...val.map((x) => `${key}: ${String(x)}`));
        else if (val != null) parts.push(`${key}: ${String(val)}`);
      }
      if (parts.length) return parts.join(" ");
    }
    if (Array.isArray(o.formErrors) && o.formErrors.length) return o.formErrors.join(" ");
    // Zod-style map at root: { email: ["…"], password: ["…"] }
    const parts: string[] = [];
    for (const [key, val] of Object.entries(e as Record<string, unknown>)) {
      if (key === "fieldErrors" || key === "formErrors") continue;
      if (Array.isArray(val)) parts.push(...val.map((x) => `${key}: ${String(x)}`));
    }
    if (parts.length) return parts.join(" ");
  }
  return t("auth.error.genericSignIn");
}

const googleOAuthEnabled =
  typeof process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID === "string" &&
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID.length > 0;

function GoogleGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginForm({ showDemoHint = false }: { showDemoHint?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultOrg = searchParams.get("org") ?? "";
  const redirectTo = searchParams.get("redirect") ?? "";
  const oauthCode = searchParams.get("error");

  const [organizationSlug, setOrganizationSlug] = useState(defaultOrg);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const oauthApplied = useRef(false);

  useEffect(() => {
    if (oauthApplied.current || !oauthCode) return;
    oauthApplied.current = true;
    const key = `auth.oauth.${oauthCode}`;
    const msg = t(key);
    setError(msg === key ? t("auth.oauth.unknown") : msg);
  }, [oauthCode, t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, organizationSlug }),
      });

      const raw = await res.text();
      let data: { error?: unknown; user?: { organization: { slug: string } } };
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        setError(t("auth.error.nonJsonResponse").replace("%s", String(res.status)));
        return;
      }

      if (!res.ok) {
        setError(formatApiError(data, t));
        return;
      }
      const slug = data.user?.organization.slug ?? organizationSlug.trim().toLowerCase();
      const target =
        redirectTo && redirectTo.startsWith("/o/") ? redirectTo : `/o/${slug}/dashboard`;
      router.push(target);
      router.refresh();
    } catch (e) {
      const failedFetch = e instanceof TypeError && String(e.message).toLowerCase().includes("fetch");
      setError(failedFetch ? t("auth.error.fetchNetwork") : t("auth.error.genericCatch"));
    } finally {
      setLoading(false);
    }
  }

  const slugForOAuth = normalizeOrgSlug(organizationSlug);
  const slugOk = isValidOrgSlug(slugForOAuth);
  const googleHref = `/api/auth/google?organizationSlug=${encodeURIComponent(slugForOAuth)}${redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`;

  return (
    <Card className="auth-card-shell surface-glass w-full max-w-md border-0 py-6 shadow-none ring-1 ring-border/40 dark:ring-white/10">
      <CardHeader className="space-y-1">
        <CardTitle className="page-title">{t("auth.signIn")}</CardTitle>
        <CardDescription className="text-pretty leading-relaxed">{t("auth.signInDescription")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {showDemoHint ? (
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{t("auth.demoHintTitle")}</p>
              <p className="mt-1">{t("auth.demoHintBody")}</p>
            </div>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/15"
            >
              {error}
            </p>
          ) : null}
          {googleOAuthEnabled ? (
            <div className="space-y-2">
              {slugOk ? (
                <a
                  href={googleHref}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "flex h-10 w-full items-center justify-center gap-2 text-sm font-medium shadow-sm transition-shadow hover:shadow-md",
                  )}
                >
                  <GoogleGlyph />
                  {t("auth.continueGoogle")}
                </a>
              ) : (
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "flex h-10 w-full items-center justify-center gap-2 text-sm font-medium",
                  )}
                  onClick={() => setError(t("auth.slugBeforeGoogle"))}
                >
                  <GoogleGlyph />
                  {t("auth.continueGoogle")}
                </button>
              )}
              <p className="text-center text-xs text-muted-foreground">{t("auth.slugMustMatch")}</p>
            </div>
          ) : null}
          {googleOAuthEnabled ? (
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t("auth.orEmail")}</span>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="org">{t("auth.schoolSlug")}</Label>
            <Input
              id="org"
              name="organizationSlug"
              autoComplete="organization"
              placeholder={t("auth.schoolSlugPlaceholder")}
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">{t("auth.schoolSlugHelp")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button type="submit" disabled={loading}>
            {loading ? t("auth.signingIn") : t("auth.signInButton")}
          </Button>
          <Link href="/register" className={cn(buttonVariants({ variant: "ghost" }), "sm:w-auto")}>
            {t("auth.createSchool")}
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
