import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { getEligibleCertificates } from "@/lib/dashboard/insights";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function CertificatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const base = `/o/${slug}`;
  const staff = isStaffRole(user.role);

  const orgPub = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { certificatesPublished: true },
  });

  const eligible =
    !staff && !orgPub?.certificatesPublished
      ? []
      : await getEligibleCertificates(user.id, user.organizationId, user.role);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {staff
              ? "Certificates are issued to students who complete every lesson in an enrolled course."
              : "Courses where you have completed all lessons. Open a certificate to print or save as PDF."}
          </p>
        </div>
        <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Dashboard
        </Link>
      </div>

      {staff ? (
        <div className="surface-bento p-6 text-sm text-muted-foreground">
          Switch to a student account or enroll as a student to earn completion certificates.
        </div>
      ) : !orgPub?.certificatesPublished ? (
        <div className="surface-bento p-8 text-center text-sm text-muted-foreground">
          Certificates are not published for students right now. Your school administrator can enable them under{" "}
          <span className="font-medium text-foreground">Admin → School settings</span>.
        </div>
      ) : eligible.length === 0 ? (
        <div className="surface-bento p-8 text-center text-sm text-muted-foreground">
          No certificates yet. Finish every lesson in a course you are enrolled in, then return here.
        </div>
      ) : (
        <ul className="space-y-3">
          {eligible.map((c) => (
            <li key={c.courseId}>
              <Link
                href={`${base}/courses/${c.courseId}/certificate`}
                className="surface-bento flex items-center justify-between gap-4 p-5 transition-colors hover:border-primary/30"
              >
                <span className="font-medium tracking-tight">{c.courseTitle}</span>
                <span className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>
                  View certificate
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
