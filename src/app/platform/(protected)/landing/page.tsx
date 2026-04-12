import Link from "next/link";
import { redirect } from "next/navigation";
import { PlatformLandingEditor } from "@/components/platform/platform-landing-editor";
import { buttonVariants } from "@/components/ui/button-variants";
import { LANDING_KEY } from "@/lib/platform/landing-defaults";
import { getPublicLandingPayload, getRawLandingRowMap } from "@/lib/platform/landing-settings";
import { getPlatformOperator } from "@/lib/platform/session";
import { cn } from "@/lib/utils";

export default async function PlatformLandingAdminPage() {
  const op = await getPlatformOperator();
  if (!op) redirect("/platform/login");

  const [merged, raw] = await Promise.all([getPublicLandingPayload(), getRawLandingRowMap()]);
  const logoRaw = raw[LANDING_KEY.logo]?.trim() ?? "";
  const faviconRaw = raw[LANDING_KEY.favicon]?.trim() ?? "";

  const initial = {
    kicker: merged.kicker,
    headline: merged.headline,
    subheadline: merged.subheadline,
    features: merged.features,
    logoRaw,
    logoPreviewUrl: merged.logoSrc,
    faviconRaw,
    faviconPreviewUrl: merged.faviconSrc,
  };

  return (
    <div>
      <Link href="/platform/settings" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4 text-muted-foreground")}>
        ← Settings
      </Link>
      <PlatformLandingEditor initial={initial} />
    </div>
  );
}
