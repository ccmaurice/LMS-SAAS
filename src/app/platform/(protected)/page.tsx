import Link from "next/link";
import { prisma } from "@/lib/db";
import { ImpersonateOrgButton } from "@/components/platform/impersonate-org-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const statusOrder = { PENDING: 0, ACTIVE: 1, REJECTED: 2 } as const;

export default async function PlatformHomePage() {
  const orgsRaw = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, courses: true } },
    },
  });

  const orgs = [...orgsRaw].sort((a, b) => {
    const d = statusOrder[a.status] - statusOrder[b.status];
    if (d !== 0) return d;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const pendingCount = orgs.filter((o) => o.status === "PENDING").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Organizations</h1>
        <p className="mt-1 text-muted-foreground">
          Open a school for full user management: suspend, edit name/role, or delete members (respects last-admin and
          database constraints). Use “Open as admin” to sign in as that org’s first admin (or teacher, then any user).
        </p>
        {pendingCount > 0 ? (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-50">
            <strong>{pendingCount}</strong> school{pendingCount === 1 ? "" : "s"} waiting for approval — check the list
            below or your notifications.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/platform/usage"
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "inline-flex items-center gap-2 shadow-sm",
            )}
          >
            Usage &amp; billing signals
          </Link>
          <p className="max-w-xl text-sm text-muted-foreground">
            Row counts, 30-day activity, weighted index per school — rank tenants for pricing and capacity.
          </p>
        </div>
      </div>

      <div className="surface-table-wrap">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Courses</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-medium">{o.name}</td>
                <td className="px-4 py-3">
                  {o.status === "PENDING" ? (
                    <Badge variant="outline" className="border-amber-500/60 text-amber-900 dark:text-amber-100">
                      Pending
                    </Badge>
                  ) : o.status === "REJECTED" ? (
                    <Badge variant="destructive">Rejected</Badge>
                  ) : (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{o.slug}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.educationLevel.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 tabular-nums">{o._count.users}</td>
                <td className="px-4 py-3 tabular-nums">{o._count.courses}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/platform/orgs/${o.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Details
                    </Link>
                    <ImpersonateOrgButton organizationId={o.id} label="Open as admin" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orgs.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No organizations yet.</p> : null}
      </div>
    </div>
  );
}
