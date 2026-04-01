import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AcceptInviteForm } from "@/components/invite/accept-invite-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const invite = await prisma.userInvite.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invite) notFound();

  const expired = invite.expiresAt <= new Date();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-6">
      <div className="pointer-events-none fixed inset-0 bg-app-mesh opacity-90 dark:opacity-100" aria-hidden />
      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="surface-glass p-8">
          <div>
            <h1 className="page-title">You&apos;re invited</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {expired
                ? "This invite link has expired. Ask an admin to send a new one."
                : `Create your account to join ${invite.organization.name}.`}
            </p>
          </div>
          {expired ? (
            <Link href="/login" className={cn(buttonVariants(), "inline-flex")}>
              Go to login
            </Link>
          ) : (
            <AcceptInviteForm
              token={invite.token}
              email={invite.email}
              orgName={invite.organization.name}
              orgSlug={invite.organization.slug}
            />
          )}
        </div>
      </div>
    </div>
  );
}
