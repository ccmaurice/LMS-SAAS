import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerT } from "@/i18n/server";
import { SchoolCalendarAdminPanel } from "@/components/admin/school-calendar-admin-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function AdminSchoolCalendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (user.role !== "ADMIN") redirect(`/o/${slug}/dashboard`);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t("dashboard.calendar.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("orgPages.adminCalendar.lead")}{" "}
            <span className="font-medium text-foreground">{t("orgPages.adminCalendar.scheduleHighlight")}</span>
            {t("orgPages.adminCalendar.leadTail")}
          </p>
        </div>
        <Link href={`/o/${slug}/dashboard#school-calendar`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {t("orgPages.adminCalendar.viewOnDashboard")}
        </Link>
      </div>
      <SchoolCalendarAdminPanel />
    </div>
  );
}
