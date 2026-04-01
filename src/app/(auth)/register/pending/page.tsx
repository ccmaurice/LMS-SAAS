import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function RegisterPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; slug?: string }>;
}) {
  const { name, slug } = await searchParams;
  const schoolName = name?.trim() || "Your school";
  const schoolSlug = slug?.trim() || "";

  return (
    <Card className="auth-card-shell surface-glass w-full max-w-md border-0 py-6 shadow-none ring-1 ring-border/40 dark:ring-white/10">
      <CardHeader className="space-y-1">
        <CardTitle className="page-title">Registration received</CardTitle>
        <CardDescription className="text-pretty leading-relaxed">
          {schoolName} is pending review by a platform operator. You cannot sign in until the school is approved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {schoolSlug ? (
          <p>
            School URL will be{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 text-foreground">/o/{schoolSlug}/…</code> after
            activation.
          </p>
        ) : null}
        <p>
          After approval, sign in with the email and password you used to register. You will also see a notification on
          your school dashboard when your account becomes active.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto")}>
          Back to home
        </Link>
        <Link href="/login" className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full sm:w-auto")}>
          Go to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
