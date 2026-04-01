import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { CreateInviteForm } from "@/components/admin/create-invite-form";
import { MemberActions } from "@/components/admin/member-actions";
import { ParentLinkForm } from "@/components/admin/parent-link-form";
import { PendingInvitesList } from "@/components/admin/pending-invites-list";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function AdminUsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (user.role !== "ADMIN") redirect(`/o/${slug}/dashboard`);

  const [users, invites] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, createdAt: true, suspendedAt: true },
    }),
    prisma.userInvite.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, token: true, expiresAt: true, createdAt: true },
    }),
  ]);

  const inviteRows = invites.map((i) => ({
    ...i,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  }));

  const labelFor = (u: { name: string | null; email: string }) => u.name?.trim() || u.email;
  const parentOptions = users.filter((u) => u.role === "PARENT").map((u) => ({ id: u.id, label: labelFor(u) }));
  const studentOptions = users.filter((u) => u.role === "STUDENT").map((u) => ({ id: u.id, label: labelFor(u) }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Users & invites</h1>
          <p className="mt-1 text-muted-foreground">
            Invite teachers and students with a link. Suspend, edit roles, or remove members (teachers and students
            only). Other school admins are managed from the platform console.
          </p>
        </div>
        <Link href={`/o/${slug}/admin/school`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          School settings
        </Link>
      </div>

      <CreateInviteForm />

      <ParentLinkForm parents={parentOptions} students={studentOptions} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Pending invites</h2>
        <PendingInvitesList invites={inviteRows} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Members ({users.length})</h2>
        <ul className="surface-bento divide-y divide-border/80 overflow-hidden dark:divide-white/10">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium">{u.name?.trim() || u.email}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
                {u.suspendedAt ? (
                  <p className="mt-1 text-xs font-medium text-destructive">Suspended · sign-in disabled</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{u.role}</Badge>
                <MemberActions
                  currentUserId={user.id}
                  member={{
                    id: u.id,
                    email: u.email,
                    name: u.name,
                    role: u.role,
                    suspendedAt: u.suspendedAt?.toISOString() ?? null,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
