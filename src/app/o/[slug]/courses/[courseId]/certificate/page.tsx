import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { CertificatePrintButton } from "@/components/courses/certificate-print-button";
import { getEnrollment, isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function CourseCertificatePage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }

  const [course, orgPub] = await Promise.all([
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
  ]);

  if (!course) notFound();

  const staff = isStaffRole(user.role);
  const enrollment = await getEnrollment(user.id, courseId);
  if (staff || !enrollment) {
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
    where: { userId: user.id, lessonId: { in: lessonIds } },
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

  const displayName = user.name?.trim() || user.email;
  const base = `/o/${slug}/courses/${courseId}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={base} className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
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
          <p>Issued on {issuedAt.toLocaleDateString(undefined, { dateStyle: "long" })}</p>
          <p className="text-xs">Credential ID: {user.id.slice(0, 8)}…{courseId.slice(0, 8)}</p>
        </div>
      </article>
      <p className="text-center text-xs text-muted-foreground print:hidden">
        Use your browser&apos;s Print dialog to save as PDF. The sidebar hides automatically when printing.
      </p>
    </div>
  );
}
