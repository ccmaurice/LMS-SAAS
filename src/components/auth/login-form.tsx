"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidOrgSlug, normalizeOrgSlug } from "@/lib/slug";

const OAUTH_ERRORS: Record<string, string> = {
  google_no_account:
    "No account in that school for this Google user. Accept an invite with the same email, then try Google again.",
  google_not_configured: "Google sign-in is not enabled on this server.",
  google_denied: "Google sign-in was cancelled.",
  google_invalid_state: "Sign-in expired. Try Google sign-in again.",
  google_invalid_org: "Enter a valid school slug, then use Google sign-in.",
  google_email_unverified: "Verify your email in Google, then try again.",
  google_link_conflict: "This Google account is linked to a different user in that school.",
  google_token_failed: "Could not complete Google sign-in. Try again.",
  google_profile_failed: "Could not load your Google profile. Try again.",
  suspended: "This account has been suspended. Contact your school administrator.",
  google_org_pending:
    "This school is still waiting for platform approval. You will be able to sign in once an operator activates it.",
  google_org_rejected: "This school registration was not approved. Contact support if you believe this is a mistake.",
};

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

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultOrg = searchParams.get("org") ?? "";
  const redirectTo = searchParams.get("redirect") ?? "";
  const oauthCode = searchParams.get("error");

  const [organizationSlug, setOrganizationSlug] = useState(defaultOrg);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    oauthCode && OAUTH_ERRORS[oauthCode] ? OAUTH_ERRORS[oauthCode] : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, organizationSlug }),
      });

      const raw = await res.text();
      let data: { error?: unknown; user?: { organization: { slug: string } } };
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        setError(
          `The server did not return JSON (${res.status}). Often this means the API crashed — check the terminal (e.g. database down or JWT_SECRET too short).`,
        );
        return;
      }

      if (!res.ok) {
        let msg = "Could not sign in. Check organization URL, email, and password.";
        if (typeof data.error === "string") {
          msg = data.error;
        } else if (data.error && typeof data.error === "object") {
          msg = JSON.stringify(data.error);
        }
        setError(msg);
        return;
      }
      const slug = data.user?.organization.slug ?? organizationSlug.trim().toLowerCase();
      const target =
        redirectTo && redirectTo.startsWith("/o/") ? redirectTo : `/o/${slug}/dashboard`;
      router.push(target);
      router.refresh();
    } catch (e) {
      const failedFetch = e instanceof TypeError && String(e.message).toLowerCase().includes("fetch");
      setError(
        failedFetch
          ? "Could not reach this app’s server. Confirm `npm run dev` is running and you’re on the same URL (e.g. http://localhost:3000), not a different port or device name."
          : "Something went wrong signing in. Try again, or check the browser console and dev server logs.",
      );
    } finally {
      setLoading(false);
    }
  }

  const slugForOAuth = normalizeOrgSlug(organizationSlug);
  const slugOk = isValidOrgSlug(slugForOAuth);
  const googleHref = `/api/auth/google?organizationSlug=${encodeURIComponent(slugForOAuth)}${redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`;

  return (
    <Card className="surface-glass w-full max-w-md border-0 py-6 ring-0 shadow-none">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your school URL, email, and password.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {googleOAuthEnabled ? (
            <div className="space-y-2">
              {slugOk ? (
                <a
                  href={googleHref}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "flex h-10 w-full items-center justify-center gap-2 text-sm font-medium",
                  )}
                >
                  <GoogleGlyph />
                  Continue with Google
                </a>
              ) : (
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "flex h-10 w-full items-center justify-center gap-2 text-sm font-medium",
                  )}
                  onClick={() => setError("Enter a valid school URL slug (e.g. demo-school) before using Google.")}
                >
                  <GoogleGlyph />
                  Continue with Google
                </button>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Your school slug must match the organization you belong to.
              </p>
            </div>
          ) : null}
          {googleOAuthEnabled ? (
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or email</span>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="org">School URL slug</Label>
            <Input
              id="org"
              name="organizationSlug"
              autoComplete="organization"
              placeholder="e.g. demo-school"
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">The path you use after /o/ — same as when you registered.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="password">Password</Label>
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
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <Link href="/register" className={cn(buttonVariants({ variant: "ghost" }), "sm:w-auto")}>
            Create a school
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
