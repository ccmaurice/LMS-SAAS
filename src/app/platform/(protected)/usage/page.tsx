import Link from "next/link";
import { redirect } from "next/navigation";
import { TenantUsageDashboard, type TenantUsageRowJson } from "@/components/platform/tenant-usage-dashboard";
import { buttonVariants } from "@/components/ui/button-variants";
import { getPlatformOperator } from "@/lib/platform/session";
import { getTenantUsageAnalytics } from "@/lib/platform/tenant-usage";
import { cn } from "@/lib/utils";

/** Cache snapshot briefly — the SQL scan is heavy on large databases. */
export const revalidate = 180;

export default async function PlatformUsagePage() {
  const op = await getPlatformOperator();
  if (!op) redirect("/platform/login");

  let tenants: TenantUsageRowJson[] = [];
  let error: string | null = null;
  try {
    const rows = await getTenantUsageAnalytics();
    tenants = rows.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    }));
  } catch (e) {
    console.error("[platform/usage]", e);
    error = e instanceof Error ? e.message : "Could not load usage analytics.";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/platform" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-muted-foreground")}>
          ← Organizations
        </Link>
        <h1 className="page-title mt-4">Tenant usage & analysis</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          Per-school database activity and a configurable weighted index to prioritize commercial follow-up. Row counts
          approximate how much each tenant stresses PostgreSQL; combine with your own Blob bandwidth and support costs.
          Public marketing pages surface as CMS row counts plus custom section cards; only the first twelve sections count
          toward the weighted index (see tenant usage dashboard). <strong className="text-foreground">School calendar</strong>{" "}
          and <strong className="text-foreground">assessment schedule</strong> row counts match Admin → School calendar and
          per-assessment schedule windows (same figures as the weighted index and CSV).{" "}
          <strong className="text-foreground">Outcome attention</strong> counts published assessments that would flag in each
          school’s Assessment outcomes (same thresholds as staff “Needs attention”); use it for proactive support, not billing
          weight. Use the table and per-tenant feature mix chart for full counts.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <TenantUsageDashboard tenants={tenants} />
      )}
    </div>
  );
}
