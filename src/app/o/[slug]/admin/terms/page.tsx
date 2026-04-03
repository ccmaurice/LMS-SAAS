import Link from "next/link";
import { redirect } from "next/navigation";
import type { EducationLevel } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/auth/session";
import { AcademicTermsPanel } from "@/components/admin/academic-terms-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { academicCalendarCopy } from "@/lib/education_context";
import { cn } from "@/lib/utils";

export default async function AdminTermsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (user.role !== "ADMIN") redirect(`/o/${slug}/dashboard`);

  const educationLevel = user.organization.educationLevel as EducationLevel;
  const cal = academicCalendarCopy(educationLevel);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{cal.pageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{cal.adminPageLead}</p>
        </div>
        <Link href={`/o/${slug}/admin/school`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← School settings
        </Link>
      </div>
      <AcademicTermsPanel educationLevel={educationLevel} />
    </div>
  );
}
