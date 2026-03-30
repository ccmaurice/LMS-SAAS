import Link from "next/link";
import { redirect } from "next/navigation";
import { PlatformDatabasePanel } from "@/components/platform/platform-database-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { getPlatformOperator } from "@/lib/platform/session";
import { platformDatabaseToolsEnabled } from "@/lib/platform/mysql-cli";
import { cn } from "@/lib/utils";

export default async function PlatformDatabasePage() {
  const op = await getPlatformOperator();
  if (!op) redirect("/platform/login");

  const toolsEnabled = platformDatabaseToolsEnabled();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/platform/settings" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-muted-foreground")}>
          ← Settings
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Database backup &amp; restore</h1>
        <p className="mt-1 text-muted-foreground">
          Platform operators can export the whole application database or restore from a <code className="rounded bg-muted px-1">.sql</code>{" "}
          file when tools are enabled on the server.
        </p>
      </div>

      <section className="surface-bento p-6">
        <h2 className="text-lg font-semibold tracking-tight">Per-school export</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          From any organization&apos;s detail page, use <strong className="text-foreground">Download core SQL</strong> for a
          partial export (users, courses, CMS, and related core rows — not every table). For a complete copy of one tenant,
          use a full dump and filter, or contact your DBA.
        </p>
        <Link href="/platform" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}>
          Go to organizations
        </Link>
      </section>

      <section className="surface-bento p-6">
        <h2 className="text-lg font-semibold tracking-tight">Full database</h2>
        <div className="mt-4">
          <PlatformDatabasePanel toolsEnabled={toolsEnabled} />
        </div>
      </section>
    </div>
  );
}
