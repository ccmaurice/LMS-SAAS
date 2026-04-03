"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { EducationLevel, Role } from "@/generated/prisma/enums";
import { academicCalendarCopy } from "@/lib/education_context/academic-period-labels";
import { navAcademicGroupsLabel } from "@/lib/school/group-labels";
import { cn } from "@/lib/utils";

const SCHOOL_SITE = "__school_site__" as const;
const VERIFY_CERT = "__verify_certificate__" as const;

type NavItem =
  | { href: string; label: string; roles: Role[] }
  | { href: typeof SCHOOL_SITE; label: string; roles: Role[] }
  | { href: typeof VERIFY_CERT; label: string; roles: Role[] };

function navItemsForOrg(educationLevel: EducationLevel): NavItem[] {
  const academicHubLabel = navAcademicGroupsLabel(educationLevel);
  const adminGroupingLabel = educationLevel === "HIGHER_ED" ? "Departments" : "Classes";
  const adminGroupingHref = educationLevel === "HIGHER_ED" ? "admin/departments" : "admin/classes";

  return [
    { href: "dashboard", label: "Dashboard", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "my-classes", label: academicHubLabel, roles: ["ADMIN", "TEACHER", "STUDENT"] },
    { href: SCHOOL_SITE, label: "School site", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "messages", label: "Messages", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "courses", label: "Courses", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "library", label: "Library", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "blog", label: "Blog", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "assessments", label: "Assessments", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "report-card", label: "Report card", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "transcript", label: "Transcript", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "certificates", label: "Certificates", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: VERIFY_CERT, label: "Verify certificate", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "settings", label: "Settings", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
    { href: "admin/cms", label: "CMS", roles: ["ADMIN"] },
    { href: "admin/users", label: "Users", roles: ["ADMIN"] },
    { href: "admin/school", label: "School", roles: ["ADMIN"] },
    { href: "admin/analytics", label: "Analytics", roles: ["ADMIN"] },
    { href: "admin/calendar", label: "School calendar", roles: ["ADMIN"] },
    { href: "admin/terms", label: academicCalendarCopy(educationLevel).navLabel, roles: ["ADMIN"] },
    { href: adminGroupingHref, label: adminGroupingLabel, roles: ["ADMIN"] },
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
    <nav className="flex flex-1 flex-col gap-1 p-2">
      {nav
        .filter((item) => item.roles.includes(role))
        .map((item) => {
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
                "rounded-lg px-3 py-2 text-sm font-medium tracking-tight transition-[color,background-color,box-shadow,transform] duration-200",
                active
                  ? "bg-gradient-to-r from-primary/12 to-primary/5 text-foreground shadow-sm ring-1 ring-primary/15 dark:from-primary/18 dark:to-primary/8 dark:ring-primary/25"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
