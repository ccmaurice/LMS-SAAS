import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { getServerT } from "@/i18n/server";
import { LibraryPanel } from "@/components/learning/library-panel";

export default async function LibraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const staff = isStaffRole(user.role);
  const staffNote =
    staff && user.role === "ADMIN"
      ? t("orgPages.library.adminNote")
      : staff
        ? t("orgPages.library.teacherNote")
        : "";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="page-title">{t("orgPages.library.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("orgPages.library.lead")}
          {staffNote}
        </p>
      </div>
      <LibraryPanel canManage={staff} />
    </div>
  );
}
