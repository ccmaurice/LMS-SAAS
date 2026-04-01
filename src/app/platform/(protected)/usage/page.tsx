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
        <h1 className="page-title mt-4">Tenant usage &amp; billing signals</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          Per-school database activity and a configurable weighted index to prioritize commercial follow-up. Row counts
          approximate how much each tenant stresses PostgreSQL; combine with your own Blob bandwidth and support costs.
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
