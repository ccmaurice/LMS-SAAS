import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerT } from "@/i18n/server";
import { SchoolClassesPanel } from "@/components/admin/school-classes-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { EducationLevel } from "@/generated/prisma/enums";

export default async function AdminClassesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (user.role !== "ADMIN") redirect(`/o/${slug}/dashboard`);

  if (user.organization.educationLevel === "HIGHER_ED") {
    redirect(`/o/${slug}/admin/departments`);
  }

  const educationLevel = user.organization.educationLevel as EducationLevel;

  const staffOptions = await prisma.user.findMany({
    where: { organizationId: user.organizationId, role: { in: ["TEACHER", "ADMIN"] } },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">
            {educationLevel === "SECONDARY" ? t("orgPages.adminClasses.titleSecondary") : t("orgPages.adminClasses.titleK12")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {educationLevel === "SECONDARY" ? t("orgPages.adminClasses.leadSecondary") : t("orgPages.adminClasses.leadK12")}
          </p>
        </div>
        <Link href={`/o/${slug}/admin/school`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {t("orgPages.backSchoolSettings")}
        </Link>
      </div>
      <SchoolClassesPanel educationLevel={educationLevel} staffOptions={staffOptions} />
    </div>
  );
}
