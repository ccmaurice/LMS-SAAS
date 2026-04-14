import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { getEligibleCertificates, getEligibleCertificatesForStudent } from "@/lib/dashboard/insights";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { getServerT } from "@/i18n/server";

export default async function CertificatesPage({
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

  const base = `/o/${slug}`;
  const staff = isStaffRole(user.role);

  const orgPub = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { certificatesPublished: true },
  });

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
        <div className="mx-auto max-w-2xl space-y-8">
          <div>
            <h1 className="page-title">{t("nav.certificates")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("orgPages.cert.parentNoStudent")}</p>
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

  const eligible =
    staff
      ? []
      : !orgPub?.certificatesPublished
        ? []
        : user.role === "PARENT"
          ? await getEligibleCertificatesForStudent(subjectUserId, user.organizationId)
          : await getEligibleCertificates(user.id, user.organizationId, user.role);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t("nav.certificates")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {staff
              ? t("orgPages.cert.introStaff")
              : user.role === "PARENT"
                ? t("orgPages.cert.introParent")
                : t("orgPages.cert.introStudent")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("orgPages.cert.verifyLead")}{" "}
            <Link href={`/school/${encodeURIComponent(slug)}/verify-certificate`} className="underline-offset-4 hover:underline">
              {t("orgPages.cert.verifyLink")}
            </Link>
            {t("orgPages.cert.verifyTail")}
          </p>
        </div>
        <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {t("orgPages.backDashboard")}
        </Link>
      </div>

      {user.role === "PARENT" && parentChildren.length > 1 ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-muted-foreground">{t("orgPages.cert.studentLabel")}</span>
          {parentChildren.map((c) => (
            <Link
              key={c.id}
              href={`${base}/certificates?child=${encodeURIComponent(c.id)}`}
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

      {staff ? (
        <div className="surface-bento p-6 text-sm text-muted-foreground">{t("orgPages.cert.staffHint")}</div>
      ) : !orgPub?.certificatesPublished ? (
        <div className="surface-bento p-8 text-center text-sm text-muted-foreground">
          {t("orgPages.cert.notPublished")}{" "}
          <span className="font-medium text-foreground">{t("orgPages.reportCard.notPublishedAdminHint")}</span>.
        </div>
      ) : eligible.length === 0 ? (
        <div className="surface-bento p-8 text-center text-sm text-muted-foreground">
          {user.role === "PARENT" ? t("orgPages.cert.emptyParent") : t("orgPages.cert.emptyStudent")}
        </div>
      ) : (
        <ul className="space-y-3">
          {eligible.map((c) => (
            <li key={c.courseId}>
              <Link
                href={`${base}/courses/${c.courseId}/certificate${
                  user.role === "PARENT" ? `?child=${encodeURIComponent(subjectUserId)}` : ""
                }`}
                className="surface-bento flex items-center justify-between gap-4 p-5 transition-colors hover:border-primary/30"
              >
                <span className="font-medium tracking-tight">{c.courseTitle}</span>
                <span className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>{t("orgPages.cert.viewCertificate")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
