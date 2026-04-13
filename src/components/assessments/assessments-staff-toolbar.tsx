"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * Org-wide assessments hub: creating assessments and viewing outcomes are scoped to a course.
 * Mirrors actions on `/courses/[courseId]/assessments` for teachers and admins.
 */
export function AssessmentsStaffToolbar({
  slug,
  courses,
  role,
}: {
  slug: string;
  courses: { id: string; title: string }[];
  role: "ADMIN" | "TEACHER";
}) {
  const initialId = useMemo(() => courses[0]?.id ?? "", [courses]);
  const [courseId, setCourseId] = useState(initialId);
  useEffect(() => {
    setCourseId((prev) => (courses.some((c) => c.id === prev) ? prev : initialId));
  }, [courses, initialId]);

  if (courses.length === 0) {
    return (
      <div className="max-w-md rounded-lg border border-border/70 bg-muted/15 px-4 py-3 text-sm text-muted-foreground dark:border-white/10">
        {role === "TEACHER" ? (
          <>
            You don&apos;t have a course where you can add assessments yet. You need to{" "}
            <strong className="text-foreground">author a course</strong> or be linked as{" "}
            <strong className="text-foreground">instructor</strong> on a class or department tied to a course. Ask an admin
            if you expect access.
          </>
        ) : (
          <>
            No courses in this school yet.{" "}
            <Link href={`/o/${slug}/courses/new`} className="font-medium text-foreground underline-offset-4 hover:underline">
              Create a course
            </Link>{" "}
            to add assessments and outcomes.
          </>
        )}
      </div>
    );
  }

  const newHref = `/o/${slug}/courses/${courseId}/assessments/new`;
  const outcomesHref = `/o/${slug}/courses/${courseId}/assessment-outcomes`;

  if (courses.length === 1) {
    return (
      <div className="flex flex-wrap gap-2">
        <Link href={newHref} className={cn(buttonVariants({ size: "sm" }))}>
          New assessment
        </Link>
        <Link href={outcomesHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Outcomes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-w-[min(100%,20rem)] flex-col gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 dark:border-white/10 sm:min-w-0 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[200px] flex-1 space-y-1.5">
        <Label htmlFor="hub-course">Course for new assessment &amp; outcomes</Label>
        <select
          id="hub-course"
          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={newHref} className={cn(buttonVariants({ size: "sm" }))}>
          New assessment
        </Link>
        <Link href={outcomesHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Outcomes
        </Link>
      </div>
    </div>
  );
}
