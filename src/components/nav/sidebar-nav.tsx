"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  FileChartColumn,
  GraduationCap,
  Home,
  LayoutDashboard,
  Library,
  MessagesSquare,
  Newspaper,
  PenSquare,
  ScrollText,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import type { EducationLevel, Role } from "@/generated/prisma/enums";
import { useI18n } from "@/components/i18n/i18n-provider";
import { cn } from "@/lib/utils";

const SCHOOL_SITE = "__school_site__" as const;
const VERIFY_CERT = "__verify_certificate__" as const;

type NavItem =
  | { href: string; labelKey: string; roles: Role[]; icon: LucideIcon }
  | { href: typeof SCHOOL_SITE; labelKey: string; roles: Role[]; icon: LucideIcon }
  | { href: typeof VERIFY_CERT; labelKey: string; roles: Role[]; icon: LucideIcon };

function navItemsForOrg(educationLevel: EducationLevel): NavItem[] {
  const hubKey =
    educationLevel === "PRIMARY"
      ? "nav.hubPrimary"
      : educationLevel === "SECONDARY"
        ? "nav.hubSecondary"
        : "nav.hubHigherEd";
  const adminGroupingKey = educationLevel === "HIGHER_ED" ? "nav.adminDepartments" : "nav.adminClasses";
  const adminGroupingHref = educationLevel === "HIGHER_ED" ? "admin/departments" : "admin/classes";
  const academicCalKey = educationLevel === "HIGHER_ED" ? "nav.academicSemesters" : "nav.academicTerms";

  return [
    { href: "dashboard", labelKey: "nav.dashboard", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: LayoutDashboard },
    { href: "my-classes", labelKey: hubKey, roles: ["ADMIN", "TEACHER", "STUDENT"], icon: Users },
    { href: SCHOOL_SITE, labelKey: "nav.schoolSite", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: Home },
    { href: "messages", labelKey: "nav.messages", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: MessagesSquare },
    { href: "courses", labelKey: "nav.courses", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: BookOpen },
    { href: "library", labelKey: "nav.library", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: Library },
    { href: "blog", labelKey: "nav.blog", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: Newspaper },
    { href: "assessments", labelKey: "nav.assessments", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: ClipboardList },
    { href: "report-card", labelKey: "nav.reportCard", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: FileChartColumn },
    { href: "transcript", labelKey: "nav.transcript", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: ScrollText },
    { href: "certificates", labelKey: "nav.certificates", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: Award },
    { href: VERIFY_CERT, labelKey: "nav.verifyCertificate", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: BadgeCheck },
    { href: "settings", labelKey: "nav.settings", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: Settings },
    { href: "admin/cms", labelKey: "nav.cms", roles: ["ADMIN"], icon: PenSquare },
    { href: "admin/users", labelKey: "nav.users", roles: ["ADMIN"], icon: UserCog },
    { href: "admin/school", labelKey: "nav.schoolAdmin", roles: ["ADMIN"], icon: Building2 },
    { href: "admin/analytics", labelKey: "nav.analytics", roles: ["ADMIN"], icon: BarChart3 },
    { href: "admin/calendar", labelKey: "nav.schoolCalendar", roles: ["ADMIN"], icon: CalendarDays },
    { href: "admin/terms", labelKey: academicCalKey, roles: ["ADMIN"], icon: GraduationCap },
    { href: adminGroupingHref, labelKey: adminGroupingKey, roles: ["ADMIN"], icon: Users },
  ];
}

export function SidebarNav({
  base,
  role,
  orgSlug,
  educationLevel,
}: {
  base: string;
  role: Role;
  orgSlug: string;
  educationLevel: EducationLevel;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const nav = navItemsForOrg(educationLevel);
  const schoolPublicPath = `/school/${orgSlug}`;

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main navigation">
      <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {t("nav.mainSection")}
      </p>
      {nav
        .filter((item) => item.roles.includes(role))
        .map((item) => {
          const Icon = item.icon;
          const href =
            item.href === SCHOOL_SITE
              ? schoolPublicPath
              : item.href === VERIFY_CERT
                ? `${schoolPublicPath}/verify-certificate`
                : `${base}/${item.href}`;
          const active =
            item.href === SCHOOL_SITE
              ? pathname === schoolPublicPath || pathname === `${schoolPublicPath}/`
              : item.href === VERIFY_CERT
                ? pathname.startsWith(`${schoolPublicPath}/verify-certificate`)
                : pathname === href || (href !== base && pathname.startsWith(`${href}/`));
          const key =
            item.href === SCHOOL_SITE ? "school-site" : item.href === VERIFY_CERT ? "verify-certificate" : item.href;
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium tracking-tight transition-[color,background-color,box-shadow,transform] duration-200",
                active
                  ? "bg-amber-500/14 text-amber-950 shadow-sm ring-1 ring-amber-500/30 dark:bg-amber-500/12 dark:text-amber-50 dark:ring-amber-400/35"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 opacity-85",
                  active ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground",
                )}
                aria-hidden
              />
              <span className="min-w-0 truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
    </nav>
  );
}
