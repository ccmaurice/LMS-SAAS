"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function PlatformHeaderTitles({ email }: { email: string }) {
  const { t } = useI18n();

  return (
    <div className="min-w-0">
      <Link href="/platform" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-0")}>
        {t("platform.operator")}
      </Link>
      <p className="truncate text-xs text-muted-foreground">
        {t("platform.subtitle")} · {email}
      </p>
    </div>
  );
}
