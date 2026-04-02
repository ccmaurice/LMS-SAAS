import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { CmsAdminPanel } from "@/components/cms/cms-admin-panel";
import { SchoolPublicCmsSection } from "@/components/cms/school-public-cms-section";
import { SCHOOL_PUBLIC_CMS_KEYS, SCHOOL_PUBLIC_EXTRA_CARDS_KEY } from "@/lib/school-public";

export default async function AdminCmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (user.role !== "ADMIN") redirect(`/o/${slug}/dashboard`);

  const keys = [...SCHOOL_PUBLIC_CMS_KEYS.map((k) => k.key), "school.public.enrollment", SCHOOL_PUBLIC_EXTRA_CARDS_KEY];
  const rows = await prisma.cmsEntry.findMany({
    where: { organizationId: user.organizationId, key: { in: keys } },
    select: { key: true, value: true },
  });
  const schoolPublicInitial: Record<string, string> = {};
  for (const k of SCHOOL_PUBLIC_CMS_KEYS.map((x) => x.key)) schoolPublicInitial[k] = "";
  schoolPublicInitial[SCHOOL_PUBLIC_EXTRA_CARDS_KEY] = "";
  for (const r of rows) {
    schoolPublicInitial[r.key] = r.value;
  }
  if (!schoolPublicInitial["school.public.about"]?.trim() && schoolPublicInitial["school.public.enrollment"]?.trim()) {
    schoolPublicInitial["school.public.about"] = schoolPublicInitial["school.public.enrollment"];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="page-title">Headless CMS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit organization copy stored in the database. Only administrators can access this panel.
        </p>
      </div>

      <SchoolPublicCmsSection slug={slug} initialValues={schoolPublicInitial} />

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">All other keys</h2>
        <CmsAdminPanel hidePrefix="school.public." />
      </div>
    </div>
  );
}
