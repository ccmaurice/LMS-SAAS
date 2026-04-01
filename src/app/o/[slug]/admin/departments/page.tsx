import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DepartmentsAdminPanel } from "@/components/admin/departments-admin-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function AdminDepartmentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (user.role !== "ADMIN") redirect(`/o/${slug}/dashboard`);

  const isHe = user.organization.educationLevel === "HIGHER_ED";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Departments & faculty</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Academic departments, chairs, instructors, and student affiliations for higher-education organizations.
          </p>
        </div>
        <Link href={`/o/${slug}/admin/school`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← School settings
        </Link>
      </div>

      {!isHe ? (
        <div className="surface-bento space-y-3 p-5 text-sm text-muted-foreground">
          <p>
            Department management is intended for organizations set to <strong className="text-foreground">Higher education</strong> in
            School settings. K–12 schools use{" "}
            <Link href={`/o/${slug}/admin/classes`} className="font-medium text-primary underline-offset-4 hover:underline">
              Admin → Classes
            </Link>{" "}
            for rosters.
          </p>
        </div>
      ) : (
        <DepartmentsAdminPanel />
      )}
    </div>
  );
}
