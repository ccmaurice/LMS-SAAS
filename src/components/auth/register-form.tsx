"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          organizationSlug: organizationSlug.trim() || undefined,
          name: name.trim() || undefined,
          email,
          password,
        }),
      });
      const data = (await res.json()) as {
        error?: unknown;
        pendingApproval?: boolean;
        organization?: { name: string; slug: string };
        user?: { organization: { slug: string } };
      };
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Could not register. Fix the highlighted fields or pick another school URL.";
        setError(msg);
        return;
      }
      if (data.pendingApproval && data.organization?.slug) {
        const q = new URLSearchParams({
          name: data.organization.name,
          slug: data.organization.slug,
        });
        router.push(`/register/pending?${q.toString()}`);
        return;
      }
      const slug = data.user?.organization.slug;
      if (slug) {
        router.push(`/o/${slug}/dashboard`);
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="surface-glass w-full max-w-md border-0 py-6 ring-0 shadow-none">
      <CardHeader>
        <CardTitle>Create your school</CardTitle>
        <CardDescription>
          Registers a new organization and makes you the admin. Teachers and students can be invited later.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="school">School name</Label>
            <Input
              id="school"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">School URL slug (optional)</Label>
            <Input
              id="slug"
              placeholder="auto-generated from name if empty"
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Used at /o/your-slug/… Lowercase, letters, numbers, hyphens.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create school"}
          </Button>
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "sm:w-auto")}>
            Already have an account
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
