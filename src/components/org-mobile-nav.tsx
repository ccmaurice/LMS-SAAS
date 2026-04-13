"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { EducationLevel, Role } from "@/generated/prisma/enums";
import { useI18n } from "@/components/i18n/i18n-provider";
import { BookOpen, ClipboardList, LayoutDashboard, MessagesSquare, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function hubKey(educationLevel: EducationLevel) {
  return educationLevel === "PRIMARY"
    ? "nav.hubPrimary"
    : educationLevel === "SECONDARY"
      ? "nav.hubSecondary"
      : "nav.hubHigherEd";
}

function items(base: string, role: Role, educationLevel: EducationLevel, t: (k: string) => string) {
  const hk = hubKey(educationLevel);
  const core = [
    { href: `${base}/dashboard`, label: t("nav.home"), icon: LayoutDashboard },
    ...(role === "STUDENT" || role === "TEACHER" || role === "ADMIN"
      ? [{ href: `${base}/my-classes`, label: t(hk), icon: Users } as const]
      : []),
    { href: `${base}/messages`, label: t("nav.messagesShort"), icon: MessagesSquare },
    { href: `${base}/courses`, label: t("nav.courses"), icon: BookOpen },
    { href: `${base}/assessments`, label: t("nav.testsShort"), icon: ClipboardList },
    { href: `${base}/settings`, label: t("nav.youShort"), icon: Settings },
  ] as const;
  return core;
}

export function OrgMobileNav({
  slug,
  role,
  educationLevel,
}: {
  slug: string;
  role: Role;
  educationLevel: EducationLevel;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const base = `/o/${slug}`;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-background/75 dark:shadow-[0_-8px_36px_-14px_rgba(0,0,0,0.45)] md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around gap-0.5 px-1 py-2">
        {items(base, role, educationLevel, t).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9px] font-medium transition-[color,background-color,box-shadow] duration-200 sm:text-[10px]",
                  active
                    ? "bg-gradient-to-b from-primary/15 to-primary/5 text-primary shadow-sm ring-1 ring-primary/20 dark:from-primary/20 dark:to-primary/10 dark:ring-primary/30"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
