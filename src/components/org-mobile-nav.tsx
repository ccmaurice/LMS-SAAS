"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, LayoutDashboard, MessagesSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = (base: string) =>
  [
    { href: `${base}/dashboard`, label: "Home", icon: LayoutDashboard },
    { href: `${base}/messages`, label: "Msgs", icon: MessagesSquare },
    { href: `${base}/courses`, label: "Courses", icon: BookOpen },
    { href: `${base}/assessments`, label: "Tests", icon: ClipboardList },
    { href: `${base}/settings`, label: "You", icon: Settings },
  ] as const;

export function OrgMobileNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/o/${slug}`;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-white/10 dark:bg-background/70 md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around gap-0.5 px-1 py-2">
        {items(base).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9px] font-medium transition-colors sm:text-[10px]",
                  active
                    ? "text-primary ring-1 ring-primary/25 ring-offset-2 ring-offset-background dark:ring-offset-background"
                    : "text-muted-foreground hover:text-foreground",
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
