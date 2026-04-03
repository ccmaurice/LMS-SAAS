import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SchoolCalendarAdminPanel } from "@/components/admin/school-calendar-admin-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function AdminSchoolCalendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (user.role !== "ADMIN") redirect(`/o/${slug}/dashboard`);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">School calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumption, closures, holidays, and school events appear on every member’s dashboard. Quizzes and exams show
            there too when course staff add an <span className="font-medium text-foreground">assessment schedule</span> on
            each assessment (continuous-assessment opens/due dates and exam windows).
          </p>
        </div>
        <Link href={`/o/${slug}/dashboard#school-calendar`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          View on dashboard
        </Link>
      </div>
      <SchoolCalendarAdminPanel />
    </div>
  );
}
