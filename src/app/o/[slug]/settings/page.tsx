import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getEducationContext } from "@/lib/education_context";
import { getServerT } from "@/i18n/server";
import { ProfileAvatarEditor } from "@/components/profile/profile-avatar-editor";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }

  const [ctx, cohortRows, currentTerm] = await Promise.all([
    getEducationContext(user.organizationId),
    user.role === "STUDENT"
      ? prisma.cohortMembership.findMany({
          where: { userId: user.id, cohort: { organizationId: user.organizationId } },
          include: { cohort: { select: { name: true, gradeLabel: true, academicYearLabel: true } } },
        })
      : Promise.resolve([]),
    prisma.academicTerm.findFirst({
      where: { organizationId: user.organizationId, isCurrent: true },
      select: { label: true, code: true },
    }),
  ]);

  const classLabel = ctx?.terminology.Class ?? "Class";
  const termLabel = ctx?.terminology.Term ?? "Term";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">{t("nav.settings")}</h1>
        <p className="mt-1 text-muted-foreground">{t("orgPages.settings.profileFor").replace("%s", user.email)}</p>
      </div>
      {user.role === "STUDENT" && (cohortRows.length > 0 || currentTerm) ? (
        <section className="surface-bento space-y-2 p-6">
          <h2 className="text-lg font-semibold tracking-tight">{t("orgPages.settings.schoolPlacement")}</h2>
          {currentTerm ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{termLabel}:</span> {currentTerm.label}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("orgPages.settings.noCurrentTerm").replace("%s", termLabel.toLowerCase())}
            </p>
          )}
          {cohortRows.length > 0 ? (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{classLabel}</p>
              <ul className="mt-1 list-inside list-disc">
                {cohortRows.map((m) => (
                  <li key={m.cohortId}>
                    {m.cohort.name}
                    {m.cohort.gradeLabel ? ` · ${m.cohort.gradeLabel}` : ""}
                    {m.cohort.academicYearLabel ? ` (${m.cohort.academicYearLabel})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("orgPages.settings.notInClass").replace("%s", classLabel.toLowerCase())}
            </p>
          )}
        </section>
      ) : null}
      <section className="surface-bento p-6">
        <h2 className="text-lg font-semibold tracking-tight">{t("orgPages.settings.profileSection")}</h2>
        <div className="mt-4 space-y-8">
          <ProfileAvatarEditor
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            }}
          />
          <ProfileForm initialName={user.name} />
        </div>
      </section>
    </div>
  );
}
