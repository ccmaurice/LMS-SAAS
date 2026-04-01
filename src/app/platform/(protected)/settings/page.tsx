import Link from "next/link";
import { redirect } from "next/navigation";
import { PlatformProfileAvatarEditor } from "@/components/profile/platform-profile-avatar-editor";
import { buttonVariants } from "@/components/ui/button-variants";
import { getPlatformOperator } from "@/lib/platform/session";
import { cn } from "@/lib/utils";

export default async function PlatformSettingsPage() {
  const op = await getPlatformOperator();
  if (!op) redirect("/platform/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/platform" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-muted-foreground")}>
          ← Back to organizations
        </Link>
        <h1 className="page-title mt-4">Platform settings</h1>
        <p className="mt-1 text-muted-foreground">Profile for {op.email}</p>
      </div>
      <section className="surface-bento p-6">
        <h2 className="text-lg font-semibold tracking-tight">Database</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Download or restore the application PostgreSQL database in <code className="rounded bg-muted px-1">.sql</code>{" "}
          form (when enabled on the server). Per-school partial exports are available from each organization page.
        </p>
        <Link
          href="/platform/database"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}
        >
          Open database tools
        </Link>
      </section>

      <section className="surface-bento p-6">
        <h2 className="text-lg font-semibold tracking-tight">Public marketing home</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Edit the platform logo, headline, and feature cards shown on <code className="rounded bg-muted px-1">/</code>.
        </p>
        <Link
          href="/platform/landing"
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-4 inline-flex")}
        >
          Edit landing page
        </Link>
      </section>

      <section className="surface-bento p-6">
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <div className="mt-4">
          <PlatformProfileAvatarEditor email={op.email} image={op.image} />
        </div>
      </section>
    </div>
  );
}
