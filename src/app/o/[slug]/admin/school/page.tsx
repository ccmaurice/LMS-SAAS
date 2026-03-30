import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { GradingPromotionPanel } from "@/components/admin/grading-promotion-panel";
import { SchoolSettingsForm } from "@/components/admin/school-settings-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

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
    },
  });

  if (!org) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href={`/o/${slug}/admin/users`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-muted-foreground")}>
          ← Users & invites
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">School settings</h1>
        <p className="mt-1 text-muted-foreground">
          Hero image for the marketing carousel, student-facing report cards and certificates, and theme colors.
        </p>
      </div>
      <section className="surface-bento p-6">
        <SchoolSettingsForm slug={slug} initial={org} />
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
