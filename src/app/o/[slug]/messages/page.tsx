import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerT } from "@/i18n/server";
import { MessagesHub } from "@/components/messages/messages-hub";

export default async function MessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">{t("nav.messages")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong>{t("orgPages.messages.dmBold")}</strong> {t("orgPages.messages.body")}{" "}
          <strong>{t("orgPages.messages.wallBold")}</strong> {t("orgPages.messages.wallTail")}
        </p>
      </div>
      <MessagesHub />
    </div>
  );
}
