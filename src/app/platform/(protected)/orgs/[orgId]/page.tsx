import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ImpersonateOrgButton } from "@/components/platform/impersonate-org-button";
import { ImpersonateUserButton } from "@/components/platform/impersonate-user-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { OrgApprovalActions } from "@/components/platform/org-approval-actions";
import { PlatformUserActions } from "@/components/platform/platform-user-actions";
import { SchoolMessagesPanel } from "@/components/messages/school-messages-panel";

export default async function PlatformOrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      users: { orderBy: [{ role: "asc" }, { email: "asc" }], select: { id: true, email: true, name: true, role: true, suspendedAt: true } },
      _count: { select: { courses: true } },
    },
  });

  if (!org) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/platform" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2 px-0")}>
            ← All organizations
          </Link>
          <h1 className="page-title">{org.name}</h1>
          <p className="text-muted-foreground">
            Slug <code className="rounded-md bg-muted px-1.5 py-0.5 text-sm">{org.slug}</code> · segment{" "}
            <span className="text-foreground">{org.educationLevel.replace(/_/g, " ")}</span> · {org._count.courses}{" "}
            courses · {org.users.length} users
            {org.status === "PENDING" ? (
              <span className="ml-2 inline-block align-middle">
                <Badge variant="outline" className="border-amber-500/60 text-amber-900 dark:text-amber-100">
                  Pending approval
                </Badge>
              </span>
            ) : null}
            {org.status === "REJECTED" ? (
              <span className="ml-2 inline-block align-middle">
                <Badge variant="destructive">Rejected</Badge>
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImpersonateOrgButton organizationId={org.id} label="Open as admin" />
          <Link href={`/o/${org.slug}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Open /o URL (needs org session)
          </Link>
          <a
            href={`/api/platform/organizations/${org.id}/export-sql`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            title="Users, org settings, courses (weights, terms, credits), curriculum shell, blog, library (with createdById), CMS, invites, wall — not assessments or enrollments."
          >
            Download core SQL
          </a>
        </div>
      </div>

      <OrgApprovalActions organizationId={org.id} status={org.status} />

      <SchoolMessagesPanel mode="platform" orgId={org.id} />

      <div className="surface-table-wrap">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">Actions</th>
              <th className="px-4 py-3 text-right">Impersonate</th>
            </tr>
          </thead>
          <tbody>
            {org.users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name?.trim() || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{u.role}</Badge>
                  {u.suspendedAt ? (
                    <p className="mt-1 text-xs font-medium text-destructive">Suspended</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right align-top">
                  <PlatformUserActions
                    organizationId={org.id}
                    user={{
                      id: u.id,
                      email: u.email,
                      name: u.name,
                      role: u.role,
                      suspendedAt: u.suspendedAt?.toISOString() ?? null,
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <ImpersonateUserButton organizationId={org.id} userId={u.id} orgSlug={org.slug} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
