"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "cmdk";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Settings,
  Users,
  BarChart3,
  Search,
  Newspaper,
  Library,
  FileEdit,
  FileChartColumn,
  Award,
  BadgeCheck,
  MessagesSquare,
  Building2,
  Home,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { EducationLevel, Role } from "@/generated/prisma/enums";
import { academicCalendarCopy } from "@/lib/education_context/academic-period-labels";
import { navAcademicGroupsLabel } from "@/lib/school/group-labels";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type CourseHit = { id: string; title: string };

export function OrgCommandMenu({
  slug,
  role,
  educationLevel,
}: {
  slug: string;
  role: Role;
  educationLevel: EducationLevel;
}) {
  const router = useRouter();
  const base = `/o/${slug}`;
  const hubLabel = navAcademicGroupsLabel(educationLevel);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [courses, setCourses] = useState<CourseHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    if (!open) {
      setQ("");
      setCourses([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/search/courses?q=${encodeURIComponent(q)}`, { credentials: "include" });
          const data = (await res.json()) as { courses?: CourseHit[] };
          setCourses(data.courses ?? []);
        } catch {
          setCourses([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [open, q]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden h-8 gap-2 text-muted-foreground md:inline-flex"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
        Search
        <kbd className="pointer-events-none hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline-block">
          ⌘K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-8 md:hidden"
        aria-label="Search"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        label="Command menu"
        shouldFilter={false}
        contentClassName="overflow-hidden p-0 sm:max-w-lg"
        overlayClassName="bg-background/60 backdrop-blur-sm dark:bg-background/40"
      >
        <CommandInput
          placeholder="Search courses or jump to…"
          value={q}
          onValueChange={setQ}
          className="h-11 border-b border-border"
        />
        <CommandList className="max-h-[min(60vh,420px)]">
          <CommandEmpty>
            {loading ? (
              <div className="space-y-2 px-2 py-3">
                <Skeleton className="h-4 w-full max-w-[240px]" />
                <Skeleton className="h-4 w-full max-w-[160px]" />
                <Skeleton className="h-4 w-full max-w-[200px]" />
              </div>
            ) : q.trim() ? (
              "No courses match."
            ) : (
              "Type to search courses."
            )}
          </CommandEmpty>

          {courses.length > 0 ? (
            <CommandGroup heading="Courses">
              {courses.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`course-${c.id}`}
                  onSelect={() => run(`${base}/courses/${c.id}`)}
                >
                  <BookOpen className="mr-2 size-4 text-muted-foreground" />
                  {c.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          <CommandSeparator />

          <CommandGroup heading="Go to">
            <CommandItem value="dash" onSelect={() => run(`${base}/dashboard`)}>
              <LayoutDashboard className="mr-2 size-4 text-muted-foreground" />
              Dashboard
            </CommandItem>
            <CommandItem value="school-public" onSelect={() => run(`/school/${slug}`)}>
              <Home className="mr-2 size-4 text-muted-foreground" />
              School public page
            </CommandItem>
            {(role === "STUDENT" || role === "TEACHER" || role === "ADMIN") && (
              <CommandItem value="academic-hub" onSelect={() => run(`${base}/my-classes`)}>
                <Users className="mr-2 size-4 text-muted-foreground" />
                {hubLabel}
              </CommandItem>
            )}
            <CommandItem value="messages" onSelect={() => run(`${base}/messages`)}>
              <MessagesSquare className="mr-2 size-4 text-muted-foreground" />
              Messages
            </CommandItem>
            <CommandItem value="courses" onSelect={() => run(`${base}/courses`)}>
              <BookOpen className="mr-2 size-4 text-muted-foreground" />
              Courses
            </CommandItem>
            <CommandItem value="assess" onSelect={() => run(`${base}/assessments`)}>
              <ClipboardList className="mr-2 size-4 text-muted-foreground" />
              Assessments
            </CommandItem>
            <CommandItem value="report-card" onSelect={() => run(`${base}/report-card`)}>
              <FileChartColumn className="mr-2 size-4 text-muted-foreground" />
              Report card
            </CommandItem>
            <CommandItem value="transcript" onSelect={() => run(`${base}/transcript`)}>
              <FileChartColumn className="mr-2 size-4 text-muted-foreground" />
              Transcript
            </CommandItem>
            <CommandItem value="certificates" onSelect={() => run(`${base}/certificates`)}>
              <Award className="mr-2 size-4 text-muted-foreground" />
              Certificates
            </CommandItem>
            <CommandItem value="verify-certificate" onSelect={() => run(`/school/${slug}/verify-certificate`)}>
              <BadgeCheck className="mr-2 size-4 text-muted-foreground" />
              Verify certificate (public)
            </CommandItem>
            <CommandItem value="settings" onSelect={() => run(`${base}/settings`)}>
              <Settings className="mr-2 size-4 text-muted-foreground" />
              Settings
            </CommandItem>
            <CommandItem value="library" onSelect={() => run(`${base}/library`)}>
              <Library className="mr-2 size-4 text-muted-foreground" />
              Library
            </CommandItem>
            <CommandItem value="blog" onSelect={() => run(`${base}/blog`)}>
              <Newspaper className="mr-2 size-4 text-muted-foreground" />
              Blog
            </CommandItem>
            {role === "ADMIN" ? (
              <>
                <CommandItem value="cms" onSelect={() => run(`${base}/admin/cms`)}>
                  <FileEdit className="mr-2 size-4 text-muted-foreground" />
                  Admin · CMS
                </CommandItem>
                <CommandItem value="users" onSelect={() => run(`${base}/admin/users`)}>
                  <Users className="mr-2 size-4 text-muted-foreground" />
                  Admin · Users
                </CommandItem>
                <CommandItem value="school" onSelect={() => run(`${base}/admin/school`)}>
                  <Building2 className="mr-2 size-4 text-muted-foreground" />
                  Admin · School settings
                </CommandItem>
                <CommandItem value="calendar" onSelect={() => run(`${base}/admin/calendar`)}>
                  <Building2 className="mr-2 size-4 text-muted-foreground" />
                  Admin · School calendar
                </CommandItem>
                <CommandItem value="terms" onSelect={() => run(`${base}/admin/terms`)}>
                  <Building2 className="mr-2 size-4 text-muted-foreground" />
                  Admin · {academicCalendarCopy(educationLevel).navLabel}
                </CommandItem>
                <CommandItem
                  value="admin-grouping"
                  onSelect={() =>
                    run(educationLevel === "HIGHER_ED" ? `${base}/admin/departments` : `${base}/admin/classes`)
                  }
                >
                  <Users className="mr-2 size-4 text-muted-foreground" />
                  {educationLevel === "HIGHER_ED" ? "Admin · Departments" : "Admin · Classes"}
                </CommandItem>
                <CommandItem value="analytics" onSelect={() => run(`${base}/admin/analytics`)}>
                  <BarChart3 className="mr-2 size-4 text-muted-foreground" />
                  Admin · Analytics
                </CommandItem>
              </>
            ) : null}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
