import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { CertificatePrintButton } from "@/components/courses/certificate-print-button";
import { OrgBrandMark } from "@/components/org/org-brand-mark";
import { getEnrollment, isStaffRole } from "@/lib/courses/access";
import { getOrganizationLogoUrl } from "@/lib/org/org-logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { CertificateVerifyQr } from "@/components/courses/certificate-verify-qr";
import {
  completionCertificateVerifyPath,
  ensureCourseCompletionCertificate,
} from "@/lib/certificates/completion-certificate";
import { getAppOrigin } from "@/lib/seo/metadata-base";

export default async function CourseCertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; courseId: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const { slug, courseId } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }

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
      notFound();
    }
    const want = typeof sp.child === "string" ? sp.child : parentChildIds[0];
    subjectUserId = parentChildIds.includes(want) ? want : parentChildIds[0];
  }

  const [course, orgPub, orgBrand] = await Promise.all([
    prisma.course.findFirst({
      where: { id: courseId, organizationId: user.organizationId },
      include: {
        organization: { select: { name: true } },
        modules: { include: { lessons: { select: { id: true } } } },
      },
    }),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { certificatesPublished: true },
    }),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, slug: true, heroImageUrl: true, logoImageUrl: true },
    }),
  ]);

  const orgLogoUrl =
    orgBrand != null
      ? await getOrganizationLogoUrl(orgBrand.id, orgBrand.slug, orgBrand.logoImageUrl, orgBrand.heroImageUrl)
      : null;

  if (!course) notFound();

  const staff = isStaffRole(user.role);
  if (staff) {
    notFound();
  }

  const enrollment = await getEnrollment(subjectUserId, courseId);
  if (!enrollment) {
    notFound();
  }

  const subject = await prisma.user.findUnique({
    where: { id: subjectUserId, organizationId: user.organizationId },
    select: { id: true, name: true, email: true },
  });
  if (!subject) {
    notFound();
  }

  if (!orgPub?.certificatesPublished) {
    notFound();
  }

  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (lessonIds.length === 0) {
    notFound();
  }

  const progress = await prisma.lessonProgress.findMany({
    where: { userId: subjectUserId, lessonId: { in: lessonIds } },
    select: { lessonId: true, completedAt: true },
  });
  const done = new Map(progress.map((p) => [p.lessonId, p.completedAt]));
  const allDone = lessonIds.every((id) => done.has(id));
  if (!allDone) {
    notFound();
  }

  const completedDates = [...done.values()].filter(Boolean) as Date[];
  const issuedAt =
    completedDates.length > 0
      ? new Date(Math.max(...completedDates.map((d) => d.getTime())))
      : new Date();

  const credential = await ensureCourseCompletionCertificate({
    organizationId: user.organizationId,
    userId: subjectUserId,
    courseId,
    issuedAt,
  });

  const displayName = subject.name?.trim() || subject.email;
  const verifyPath = completionCertificateVerifyPath(slug, credential.id);
  const verifyUrl = `${getAppOrigin()}${verifyPath}`;
  const base = `/o/${slug}/courses/${courseId}`;
  const childQuery = user.role === "PARENT" ? `?child=${encodeURIComponent(subjectUserId)}` : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`${base}${childQuery}`} className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          ← Back to course
        </Link>
        <CertificatePrintButton />
      </div>
      <article
        className={cn(
          "certificate-print surface-bento relative overflow-hidden border-primary/25 px-8 py-12 text-center",
          "print:border-muted print:shadow-none",
        )}
      >
        <div className="relative z-10 flex flex-col items-center gap-3">
          <OrgBrandMark url={orgLogoUrl} size="lg" className="mx-auto max-w-[240px] object-center" />
        </div>
        <p className="relative z-10 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Certificate of completion
        </p>
        <p className="relative z-10 mt-2 text-sm text-muted-foreground">{course.organization.name}</p>
        <h1 className="relative z-10 mt-8 font-serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {displayName}
        </h1>
        <p className="relative z-10 mt-6 text-muted-foreground">has successfully completed</p>
        <p className="relative z-10 mt-2 text-xl font-semibold text-foreground md:text-2xl">{course.title}</p>
        <div className="relative z-10 mt-10 flex flex-col items-center gap-1 border-t border-border/80 pt-8 text-sm text-muted-foreground dark:border-white/10">
          <p>Issued on {credential.issuedAt.toLocaleDateString(undefined, { dateStyle: "long" })}</p>
          <p className="font-mono text-xs tracking-tight text-foreground">Credential ID: {credential.id}</p>
          <p className="max-w-md text-xs text-muted-foreground print:max-w-none">
            Verify at{" "}
            <span className="break-all text-foreground">{verifyUrl}</span>
          </p>
        </div>
        <div className="relative z-10 mt-8 flex justify-center print:mt-6">
          <CertificateVerifyQr verifyUrl={verifyUrl} className="rounded-lg border border-border/60 bg-white p-2 dark:border-white/10 dark:bg-white" />
        </div>
      </article>
      <p className="text-center text-xs text-muted-foreground print:hidden">
        Use your browser&apos;s Print dialog to save as PDF. The sidebar hides automatically when printing.
      </p>
    </div>
  );
}
