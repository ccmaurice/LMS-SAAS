import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { CertificatePrintButton } from "@/components/courses/certificate-print-button";
import { CourseCompletionCertificateView } from "@/components/courses/course-completion-certificate";
import { getEnrollment, isStaffRole } from "@/lib/courses/access";
import { getOrganizationLogoUrl } from "@/lib/org/org-logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  completionCertificateVerifyPath,
  ensureCourseCompletionCertificate,
} from "@/lib/certificates/completion-certificate";
import { getAppOrigin } from "@/lib/seo/metadata-base";
import { parseOrganizationSettings } from "@/lib/education_context";
import { resolveOrganizationCertificateThemeHex } from "@/lib/org-branding";

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

  const [course, orgRow] = await Promise.all([
    prisma.course.findFirst({
      where: { id: courseId, organizationId: user.organizationId },
      include: {
        organization: { select: { name: true } },
        modules: { include: { lessons: { select: { id: true } } } },
      },
    }),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        certificatesPublished: true,
        id: true,
        slug: true,
        heroImageUrl: true,
        logoImageUrl: true,
        organizationSettings: true,
        themeTemplate: true,
        customPrimaryHex: true,
      },
    }),
  ]);

  const orgSettings = orgRow != null ? parseOrganizationSettings(orgRow.organizationSettings) : {};

  const orgLogoUrl =
    orgRow != null
      ? await getOrganizationLogoUrl(orgRow.id, orgRow.slug, orgRow.logoImageUrl, orgRow.heroImageUrl)
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

  if (!orgRow?.certificatesPublished) {
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

  const themeInkHex = resolveOrganizationCertificateThemeHex(
    orgRow?.themeTemplate ?? "DEFAULT",
    orgRow?.customPrimaryHex ?? null,
  );

  return (
    <div className="mx-auto max-w-[960px] space-y-6 px-4 py-6 sm:px-6 print:max-w-none print:px-0 print:py-2">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`${base}${childQuery}`} className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          ← Back to course
        </Link>
        <CertificatePrintButton />
      </div>
      <CourseCompletionCertificateView
        orgSlug={slug}
        themeInkHex={themeInkHex}
        orgName={course.organization.name}
        orgLogoUrl={orgLogoUrl}
        recipientDisplayName={displayName}
        courseTitle={course.title}
        issuedAt={credential.issuedAt}
        verifyUrl={verifyUrl}
        credentialId={credential.id}
        certificate={{
          certificateSignerName: orgSettings.certificateSignerName,
          certificateSignerTitle: orgSettings.certificateSignerTitle,
          certificateSignatureImageUrl: orgSettings.certificateSignatureImageUrl,
          certificateCompletionPhrase: orgSettings.certificateCompletionPhrase,
        }}
      />
      <p className="text-center text-xs text-muted-foreground print:hidden">
        Use your browser&apos;s Print dialog to save as PDF. The sidebar hides automatically when printing. Credential ID
        and QR link to the public verify page for this school.
      </p>
    </div>
  );
}
