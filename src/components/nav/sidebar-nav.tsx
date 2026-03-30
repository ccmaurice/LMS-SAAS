"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const SCHOOL_SITE = "__school_site__" as const;

type NavItem =
  | { href: string; label: string; roles: Role[] }
  | { href: typeof SCHOOL_SITE; label: string; roles: Role[] };

const nav: NavItem[] = [
  { href: "dashboard", label: "Dashboard", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: SCHOOL_SITE, label: "School site", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "messages", label: "Messages", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "courses", label: "Courses", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "library", label: "Library", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "blog", label: "Blog", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "assessments", label: "Assessments", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "report-card", label: "Report card", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "certificates", label: "Certificates", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "settings", label: "Settings", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "admin/cms", label: "CMS", roles: ["ADMIN"] },
  { href: "admin/users", label: "Users", roles: ["ADMIN"] },
  { href: "admin/school", label: "School", roles: ["ADMIN"] },
  { href: "admin/analytics", label: "Analytics", roles: ["ADMIN"] },
];

export function SidebarNav({ base, role, orgSlug }: { base: string; role: Role; orgSlug: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 p-2">
      {nav
        .filter((item) => item.roles.includes(role))
        .map((item) => {
          const href = item.href === SCHOOL_SITE ? `/school/${orgSlug}` : `${base}/${item.href}`;
          const active =
            item.href === SCHOOL_SITE
              ? pathname.startsWith(`/school/${orgSlug}`)
              : pathname === href || (href !== base && pathname.startsWith(`${href}/`));
          const key = item.href === SCHOOL_SITE ? "school-site" : item.href;
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium tracking-tight transition-colors",
                active
                  ? "bg-primary/10 text-foreground ring-1 ring-border/70 dark:bg-primary/15 dark:ring-white/10"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
