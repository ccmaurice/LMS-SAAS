import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserPromotionSnapshot, getUserReportCardRows } from "@/lib/dashboard/insights";
import { ReportCardView } from "@/components/report-card/report-card-view";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function ReportCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const orgPub = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      reportCardsPublished: true,
      name: true,
      academicYearLabel: true,
    },
  });

  const base = `/o/${slug}`;

  if (user.role === "STUDENT" && !orgPub?.reportCardsPublished) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Report card</h1>
            <p className="mt-1 text-sm text-muted-foreground">Submitted assessments and scores across your courses.</p>
          </div>
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            ← Dashboard
          </Link>
        </div>
        <div className="surface-bento p-8 text-center text-sm text-muted-foreground">
          Report cards are not published for students right now. Your school administrator can turn them on under{" "}
          <span className="font-medium text-foreground">Admin → School settings</span>.
        </div>
      </div>
    );
  }

  const [rows, snapshot] = await Promise.all([
    getUserReportCardRows(user.id, user.organizationId, user.role),
    getUserPromotionSnapshot(user.id, user.organizationId),
  ]);

  const rowsClient = rows.map((r) => ({
    ...r,
    submittedAt: r.submittedAt?.toISOString() ?? null,
  }));

  const snapshotClient = snapshot
    ? {
        semester1AvgPercent: snapshot.semester1AvgPercent,
        semester2AvgPercent: snapshot.semester2AvgPercent,
        semester3AvgPercent: snapshot.semester3AvgPercent,
        cumulativeAvgPercent: snapshot.cumulativeAvgPercent,
        standing: snapshot.standing,
        computedAt: snapshot.computedAt.toISOString(),
      }
    : null;

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Report card</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Submitted assessments and scores across your courses in this organization.
            </p>
          </div>
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            ← Dashboard
          </Link>
        </div>
        <div className="surface-bento p-8 text-center text-sm text-muted-foreground">
          No submitted assessments yet.{" "}
          <Link href={`${base}/assessments`} className="font-medium text-primary underline-offset-4 hover:underline">
            Open assessments
          </Link>{" "}
          from a course you are enrolled in.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <ReportCardView
        slug={slug}
        rows={rowsClient}
        snapshot={snapshotClient}
        orgName={orgPub?.name ?? "School"}
        academicYearLabel={orgPub?.academicYearLabel ?? "—"}
      />
    </div>
  );
}
