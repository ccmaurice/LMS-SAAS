import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserPromotionSnapshot, getUserReportCardRows } from "@/lib/dashboard/insights";
import { buildStudentTranscript } from "@/lib/transcript/build-transcript";
import { ReportCardView } from "@/components/report-card/report-card-view";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { getOrganizationLogoUrl } from "@/lib/org/org-logo";
import { getServerT } from "@/i18n/server";

export default async function ReportCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const orgPub = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      id: true,
      slug: true,
      heroImageUrl: true,
      logoImageUrl: true,
      reportCardsPublished: true,
      name: true,
      academicYearLabel: true,
      educationLevel: true,
    },
  });
  const orgLogoUrl =
    orgPub != null
      ? await getOrganizationLogoUrl(orgPub.id, orgPub.slug, orgPub.logoImageUrl, orgPub.heroImageUrl)
      : null;

  const base = `/o/${slug}`;

  const parentLinks =
    user.role === "PARENT"
      ? await prisma.parentStudentLink.findMany({
          where: { parentUserId: user.id, organizationId: user.organizationId },
          select: { studentUserId: true },
        })
      : [];
  const parentChildIds = parentLinks.map((l) => l.studentUserId);

  let subjectUserId = user.id;
  if (user.role === "PARENT") {
    if (parentChildIds.length === 0) {
      return (
        <div className="mx-auto max-w-4xl space-y-8">
          <div>
            <h1 className="page-title">{t("nav.reportCard")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("orgPages.reportCard.parentNoStudent")}</p>
          </div>
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {t("orgPages.backDashboard")}
          </Link>
        </div>
      );
    }
    const want = typeof sp.child === "string" ? sp.child : parentChildIds[0];
    subjectUserId = parentChildIds.includes(want) ? want : parentChildIds[0];
  }

  const parentChildren =
    user.role === "PARENT" && parentChildIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: parentChildIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

  if (
    (user.role === "STUDENT" || user.role === "PARENT") &&
    !orgPub?.reportCardsPublished
  ) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="page-title">{t("nav.reportCard")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.role === "PARENT" ? t("orgPages.reportCard.subtitleParent") : t("orgPages.reportCard.subtitleStudent")}
            </p>
          </div>
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {t("orgPages.backDashboard")}
          </Link>
        </div>
        <div className="surface-bento p-8 text-center text-sm text-muted-foreground">
          {t("orgPages.reportCard.notPublishedBlurb")}{" "}
          <span className="font-medium text-foreground">{t("orgPages.reportCard.notPublishedAdminHint")}</span>.
        </div>
      </div>
    );
  }

  const [rows, snapshot, transcriptPayload] = await Promise.all([
    getUserReportCardRows(
      subjectUserId,
      user.organizationId,
      user.role === "PARENT" ? "STUDENT" : user.role,
    ),
    getUserPromotionSnapshot(subjectUserId, user.organizationId),
    orgPub?.educationLevel === "HIGHER_ED"
      ? buildStudentTranscript(subjectUserId, user.organizationId)
      : Promise.resolve(null),
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
            <h1 className="page-title">{t("nav.reportCard")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("orgPages.reportCard.emptySubtitle")}</p>
          </div>
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {t("orgPages.backDashboard")}
          </Link>
        </div>
        <div className="surface-bento space-y-3 p-8 text-center text-sm text-muted-foreground">
          <p>
            {t("orgPages.reportCard.noSubmissions")}{" "}
            <Link href={`${base}/assessments`} className="font-medium text-primary underline-offset-4 hover:underline">
              {t("orgPages.reportCard.openAssessments")}
            </Link>{" "}
            {t("orgPages.reportCard.fromEnrolledCourse")}
          </p>
          {orgPub?.educationLevel === "HIGHER_ED" ? (
            <p>
              <Link href={`${base}/transcript`} className="font-medium text-primary underline-offset-4 hover:underline">
                {t("orgPages.reportCard.viewTranscriptGpa")}
              </Link>{" "}
              {t("orgPages.reportCard.transcriptGpaSuffix")}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 print:max-w-none">
      {user.role === "PARENT" && parentChildren.length > 1 ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-muted-foreground">{t("orgPages.reportCard.studentLabel")}</span>
          {parentChildren.map((c) => (
            <Link
              key={c.id}
              href={`${base}/report-card?child=${encodeURIComponent(c.id)}`}
              className={cn(
                buttonVariants({
                  variant: c.id === subjectUserId ? "default" : "outline",
                  size: "sm",
                }),
              )}
            >
              {c.name?.trim() || c.email}
            </Link>
          ))}
        </div>
      ) : null}
      <ReportCardView
        slug={slug}
        rows={rowsClient}
        snapshot={snapshotClient}
        orgName={orgPub?.name ?? "School"}
        orgLogoUrl={orgLogoUrl}
        academicYearLabel={orgPub?.academicYearLabel ?? "—"}
        educationLevel={orgPub?.educationLevel}
        gpaSummary={
          transcriptPayload
            ? {
                cumulativeGpa: transcriptPayload.cumulativeGpa,
                totalCreditsGraded: transcriptPayload.totalCreditsGraded,
              }
            : null
        }
        childQuery={user.role === "PARENT" ? `?child=${encodeURIComponent(subjectUserId)}` : ""}
      />
    </div>
  );
}
