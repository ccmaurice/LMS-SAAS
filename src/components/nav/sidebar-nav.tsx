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
import { academicCalendarCopy } from "@/lib/education_context/academic-period-labels";
import { navAcademicGroupsLabel } from "@/lib/school/group-labels";
import { cn } from "@/lib/utils";

const SCHOOL_SITE = "__school_site__" as const;
const VERIFY_CERT = "__verify_certificate__" as const;

type NavItem =
  | { href: string; label: string; roles: Role[]; icon: LucideIcon }
  | { href: typeof SCHOOL_SITE; label: string; roles: Role[]; icon: LucideIcon }
  | { href: typeof VERIFY_CERT; label: string; roles: Role[]; icon: LucideIcon };

function navItemsForOrg(educationLevel: EducationLevel): NavItem[] {
  const academicHubLabel = navAcademicGroupsLabel(educationLevel);
  const adminGroupingLabel = educationLevel === "HIGHER_ED" ? "Departments" : "Classes";
  const adminGroupingHref = educationLevel === "HIGHER_ED" ? "admin/departments" : "admin/classes";

  return [
    { href: "dashboard", label: "Dashboard", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: LayoutDashboard },
    { href: "my-classes", label: academicHubLabel, roles: ["ADMIN", "TEACHER", "STUDENT"], icon: Users },
    { href: SCHOOL_SITE, label: "School site", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: Home },
    { href: "messages", label: "Messages", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: MessagesSquare },
    { href: "courses", label: "Courses", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: BookOpen },
    { href: "library", label: "Library", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: Library },
    { href: "blog", label: "Blog", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: Newspaper },
    { href: "assessments", label: "Assessments", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: ClipboardList },
    { href: "report-card", label: "Report card", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: FileChartColumn },
    { href: "transcript", label: "Transcript", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: ScrollText },
    { href: "certificates", label: "Certificates", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: Award },
    { href: VERIFY_CERT, label: "Verify certificate", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: BadgeCheck },
    { href: "settings", label: "Settings", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"], icon: Settings },
    { href: "admin/cms", label: "CMS", roles: ["ADMIN"], icon: PenSquare },
    { href: "admin/users", label: "Users", roles: ["ADMIN"], icon: UserCog },
    { href: "admin/school", label: "School", roles: ["ADMIN"], icon: Building2 },
    { href: "admin/analytics", label: "Analytics", roles: ["ADMIN"], icon: BarChart3 },
    { href: "admin/calendar", label: "School calendar", roles: ["ADMIN"], icon: CalendarDays },
    { href: "admin/terms", label: academicCalendarCopy(educationLevel).navLabel, roles: ["ADMIN"], icon: GraduationCap },
    { href: adminGroupingHref, label: adminGroupingLabel, roles: ["ADMIN"], icon: Users },
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
  const nav = navItemsForOrg(educationLevel);
  const schoolPublicPath = `/school/${orgSlug}`;

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main navigation">
      <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Main</p>
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
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
