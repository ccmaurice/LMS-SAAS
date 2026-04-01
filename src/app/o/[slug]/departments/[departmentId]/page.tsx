import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canPostDepartmentMessage, canReadDepartmentMessages } from "@/lib/school/department-access";
import { DepartmentMessagesPanel } from "@/components/departments/department-messages-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { navAcademicGroupsLabel } from "@/lib/school/group-labels";

export default async function DepartmentHubPage({
  params,
}: {
  params: Promise<{ slug: string; departmentId: string }>;
}) {
  const { slug, departmentId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const orgRow = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { educationLevel: true },
  });
  const hub = navAcademicGroupsLabel(orgRow?.educationLevel ?? "SECONDARY");

  const dept = await prisma.academicDepartment.findFirst({
    where: { id: departmentId, organizationId: user.organizationId },
    select: {
      id: true,
      name: true,
      code: true,
      facultyDivision: { select: { name: true } },
    },
  });
  if (!dept) notFound();

  const canRead = await canReadDepartmentMessages(user.id, user.role, departmentId, user.organizationId);
  if (!canRead) notFound();

  const canPost = await canPostDepartmentMessage(user.id, user.role, departmentId, user.organizationId);
  const base = `/o/${slug}`;
  const subtitle = [dept.code, dept.facultyDivision?.name].filter(Boolean).join(" · ") || "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{dept.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Link href={`${base}/my-classes`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← My {hub}
        </Link>
      </div>
      <DepartmentMessagesPanel departmentId={departmentId} canPost={canPost} />
    </div>
  );
}
