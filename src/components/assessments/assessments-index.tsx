"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AssessmentStaffLockToggle } from "@/components/assessments/assessment-staff-lock-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export type AssessmentStaffRow = {
  id: string;
  title: string;
  course: { id: string; title: string };
  studentAttemptsLocked: boolean;
};

export type AssessmentStudentRow = {
  id: string;
  title: string;
  course: { id: string; title: string };
  latestSubmissionId?: string | null;
  /** Blocks new attempts unless student has a draft (parent view ignores for navigation). */
  studentAttemptsLocked?: boolean;
  hasDraft?: boolean;
};

export function AssessmentsStaffList({ slug, rows }: { slug: string; rows: AssessmentStaffRow[] }) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid gap-4 md:grid-cols-12">
      {rows.map((a, i) => (
        <motion.li
          key={a.id}
          className={cn(
            "surface-bento flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between",
            i === 0 ? "md:col-span-8 bento-course-active" : "md:col-span-4",
          )}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32, delay: i * 0.04 }}
          whileHover={reduce ? undefined : { y: -2, transition: { type: "spring", stiffness: 500, damping: 26 } }}
        >
          <div className="relative z-10 min-w-0">
            <p className="font-semibold tracking-tight">{a.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{a.course.title}</p>
          </div>
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            {a.studentAttemptsLocked ? (
              <Badge variant="outline" className="border-amber-500/50 text-amber-950 dark:text-amber-100">
                Attempts locked
              </Badge>
            ) : null}
            <AssessmentStaffLockToggle assessmentId={a.id} initialLocked={a.studentAttemptsLocked} />
            <Link
              href={`/o/${slug}/courses/${a.course.id}/assessment-outcomes`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Outcomes
            </Link>
            <Link
              href={`/o/${slug}/courses/${a.course.id}/assessments/${a.id}/edit`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Edit
            </Link>
            <Link
              href={`/o/${slug}/courses/${a.course.id}/assessments/${a.id}/gradebook`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Gradebook
            </Link>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}

export function AssessmentsStudentList({
  slug,
  rows,
  viewer = "student",
}: {
  slug: string;
  rows: AssessmentStudentRow[];
  viewer?: "student" | "parent";
}) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid gap-4 md:grid-cols-12">
      {rows.map((a, i) => (
        <motion.li
          key={a.id}
          className={cn("surface-bento flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between", i === 0 ? "md:col-span-8" : "md:col-span-4")}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32, delay: i * 0.04 }}
          whileHover={reduce ? undefined : { y: -2, transition: { type: "spring", stiffness: 500, damping: 26 } }}
        >
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">{a.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{a.course.title}</p>
          </div>
          {viewer === "parent" && !a.latestSubmissionId ? (
            <span className={cn(buttonVariants({ variant: "secondary" }), "shrink-0 cursor-not-allowed opacity-70")}>
              No submission yet
            </span>
          ) : viewer === "student" && a.studentAttemptsLocked && !a.hasDraft ? (
            <span
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "shrink-0 cursor-not-allowed text-center opacity-80",
              )}
            >
              Closed to new attempts
            </span>
          ) : (
            <Link
              href={
                viewer === "parent" && a.latestSubmissionId
                  ? `/o/${slug}/courses/${a.course.id}/assessments/${a.id}/results?submissionId=${encodeURIComponent(a.latestSubmissionId)}`
                  : `/o/${slug}/courses/${a.course.id}/assessments/${a.id}/take`
              }
              className={cn(buttonVariants(), "shrink-0")}
            >
              {viewer === "parent" ? "View results" : a.studentAttemptsLocked && a.hasDraft ? "Resume" : "Open"}
            </Link>
          )}
        </motion.li>
      ))}
    </ul>
  );
}
