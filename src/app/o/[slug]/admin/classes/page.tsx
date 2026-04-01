import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { SchoolClassesPanel } from "@/components/admin/school-classes-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { EducationLevel } from "@/generated/prisma/enums";

export default async function AdminClassesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
            {educationLevel === "SECONDARY" ? "Form groups & rosters" : "Classes & homerooms"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {educationLevel === "SECONDARY"
              ? "Secondary form groups, optional track or pathway labels, and student rosters. Use each student’s school email when adding."
              : "Assign primary students to a class roster. Use the student’s school email when adding."}
          </p>
        </div>
        <Link href={`/o/${slug}/admin/school`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← School settings
        </Link>
      </div>
      <SchoolClassesPanel educationLevel={educationLevel} staffOptions={staffOptions} />
    </div>
  );
}
