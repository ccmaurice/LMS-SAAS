import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { GradingPromotionPanel } from "@/components/admin/grading-promotion-panel";
import { SchoolSettingsForm } from "@/components/admin/school-settings-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { academicCalendarCopy, parseOrganizationSettings } from "@/lib/education_context";

export default async function AdminSchoolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (user.role !== "ADMIN") redirect(`/o/${slug}/dashboard`);

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      reportCardsPublished: true,
      certificatesPublished: true,
      academicYearLabel: true,
      promotionPassMinPercent: true,
      promotionProbationMinPercent: true,
      themeTemplate: true,
      customPrimaryHex: true,
      customAccentHex: true,
      heroImageUrl: true,
      logoImageUrl: true,
      educationLevel: true,
      organizationSettings: true,
    },
  });

  if (!org) redirect("/login");

  const orgSettings = parseOrganizationSettings(org.organizationSettings);
  const cal = academicCalendarCopy(org.educationLevel);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href={`/o/${slug}/admin/users`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-muted-foreground")}>
          ← Users & invites
        </Link>
        <h1 className="page-title mt-4">School settings</h1>
        <p className="mt-1 text-muted-foreground">
          Brand logo (upload or link), public hero image for marketing, education level, and theme colors.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/o/${slug}/admin/calendar`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            School calendar
          </Link>
          <Link href={`/o/${slug}/admin/terms`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {cal.navLabel}
          </Link>
          <Link
            href={org.educationLevel === "HIGHER_ED" ? `/o/${slug}/admin/departments` : `/o/${slug}/admin/classes`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {org.educationLevel === "HIGHER_ED" ? "Departments & faculty" : "Classes & homerooms"}
          </Link>
        </div>
      </div>
      <section className="surface-bento p-6">
        <SchoolSettingsForm
          slug={slug}
          initial={{
            ...org,
            reportShowRank: orgSettings.reportShowRank ?? false,
            gpaBands: orgSettings.gpaBands,
          }}
        />
      </section>
      <section className="surface-bento p-6">
        <GradingPromotionPanel
          initial={{
            academicYearLabel: org.academicYearLabel,
            promotionPassMinPercent: org.promotionPassMinPercent,
            promotionProbationMinPercent: org.promotionProbationMinPercent,
          }}
        />
      </section>
    </div>
  );
}
