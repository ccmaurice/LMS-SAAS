import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canPostCohortMessage, canReadCohortMessages } from "@/lib/school/cohort-access";
import { ClassMessagesPanel } from "@/components/cohorts/class-messages-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { navAcademicGroupsLabel } from "@/lib/school/group-labels";

export default async function ClassRoomPage({
  params,
}: {
  params: Promise<{ slug: string; cohortId: string }>;
}) {
  const { slug, cohortId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const cohort = await prisma.schoolCohort.findFirst({
    where: { id: cohortId, organizationId: user.organizationId },
    select: {
      id: true,
      name: true,
      gradeLabel: true,
      academicYearLabel: true,
      trackLabel: true,
    },
  });
  if (!cohort) notFound();

  const canRead = await canReadCohortMessages(user.id, user.role, cohortId, user.organizationId);
  if (!canRead) notFound();

  const canPost = await canPostCohortMessage(user.id, user.role, cohortId, user.organizationId);
  const base = `/o/${slug}`;
  const hub = navAcademicGroupsLabel(user.organization.educationLevel);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{cohort.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cohort.gradeLabel ? `${cohort.gradeLabel} · ` : ""}
            {cohort.academicYearLabel || "—"}
            {cohort.trackLabel ? ` · ${cohort.trackLabel}` : ""}
          </p>
        </div>
        <Link href={`${base}/my-classes`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← My {hub}
        </Link>
      </div>
      <ClassMessagesPanel cohortId={cohortId} canPost={canPost} />
    </div>
  );
}
