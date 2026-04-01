"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { EnrollButton } from "@/components/courses/enroll-button";

export type StaffCourseRow = {
  id: string;
  title: string;
  published: boolean;
  _count: { modules: number; enrollments: number };
  createdBy: { name: string | null; email: string };
};

export type EnrollmentRow = {
  id: string;
  courseId: string;
  progressPercent: number;
  course: { title: string };
};

export type CatalogRow = {
  id: string;
  title: string;
  _count: { modules: number };
};

export function CoursesStaffView({ base, courses }: { base: string; courses: StaffCourseRow[] }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <ul className="grid gap-4 md:grid-cols-12">
      {courses.map((c, i) => (
        <motion.li
          key={c.id}
          className={cn(
            "surface-bento p-5",
            i === 0 ? "md:col-span-8" : "md:col-span-4",
            i === 0 ? "bento-course-active" : "",
          )}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32, delay: i * 0.04 }}
          whileHover={reduce ? undefined : { y: -3, transition: { type: "spring", stiffness: 520, damping: 28 } }}
        >
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-2">
            <Link href={`${base}/${c.id}`} className="font-semibold tracking-tight text-foreground hover:underline">
              {c.title}
            </Link>
            <Badge variant={c.published ? "default" : "secondary"}>{c.published ? "Published" : "Draft"}</Badge>
          </div>
          <p className="relative z-10 mt-2 text-sm text-muted-foreground">
            {c._count.modules} modules · {c._count.enrollments} enrolled
          </p>
          <p className="relative z-10 mt-1 text-xs text-muted-foreground">
            By {c.createdBy.name ?? c.createdBy.email}
          </p>
          <div className="relative z-10 mt-4 flex flex-wrap gap-2">
            <Link href={`${base}/${c.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Edit
            </Link>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}

export function CoursesStudentView({
  base,
  enrollments,
  catalog,
}: {
  base: string;
  enrollments: EnrollmentRow[];
  catalog: CatalogRow[];
}) {
  const reduce = useReducedMotion() ?? false;
  return (
    <>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">My enrollments</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">You are not enrolled in any course yet.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-12">
            {enrollments.map((e, i) => (
              <motion.li
                key={e.id}
                className={cn("surface-bento p-5", i === 0 ? "bento-course-active md:col-span-8" : "md:col-span-4")}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 32, delay: i * 0.05 }}
                whileHover={reduce ? undefined : { y: -3, transition: { type: "spring", stiffness: 520, damping: 28 } }}
              >
                <div className="relative z-10">
                  <Link
                    href={`${base}/${e.courseId}`}
                    className="font-semibold tracking-tight underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {e.course.title}
                  </Link>
                  <p className="mt-2 text-sm text-muted-foreground">Progress: {Math.round(e.progressPercent)}%</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/80 ring-1 ring-inset ring-border/50 dark:ring-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/75 transition-[width] duration-500 ease-out dark:from-primary dark:to-primary/65"
                      style={{ width: `${Math.min(100, Math.max(0, e.progressPercent))}%` }}
                    />
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="section-heading">Catalog</h2>
        {catalog.length === 0 ? (
          <div className="empty-state">
            <p>No published courses are open for enrollment right now.</p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-12">
            {catalog.map((c, i) => (
              <motion.li
                key={c.id}
                className={cn(
                  "surface-bento flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between",
                  i === 0 ? "md:col-span-8" : "md:col-span-4",
                )}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 32, delay: i * 0.04 }}
                whileHover={reduce ? undefined : { y: -2, transition: { type: "spring", stiffness: 520, damping: 28 } }}
              >
                <div>
                  <Link
                    href={`${base}/${c.id}`}
                    className="font-semibold tracking-tight underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {c.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">{c._count.modules} modules</p>
                </div>
                <EnrollButton courseId={c.id} enrolled={false} />
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
