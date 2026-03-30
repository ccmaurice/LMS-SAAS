"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MessageCircle, MessagesSquare, FileChartColumn, Award, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export type DashboardBentoProps = {
  slug: string;
  userEmail: string;
  userRole: string;
  orgName: string;
  cmsWelcome?: string;
  cmsSubtitle?: string;
  enrollmentTotal: number;
  publishedAssessments: number;
  teachingCount: number;
  draftCourses: number;
  staff: boolean;
  studentScopedAssessments: boolean;
  enrollments: {
    id: string;
    progressPercent: number;
    course: { id: string; title: string; published: boolean };
  }[];
  recentSchoolMessages: {
    id: string;
    bodyPreview: string;
    createdAt: string;
    authorLabel: string;
    isPlatform: boolean;
  }[];
  recentDiscussions: {
    id: string;
    bodyPreview: string;
    createdAt: string;
    authorLabel: string;
    courseId: string;
    courseTitle: string;
  }[];
  reportPreview: {
    submissionId: string;
    assessmentId: string;
    assessmentTitle: string;
    courseId: string;
    courseTitle: string;
    totalScore: number | null;
    maxScore: number | null;
  }[];
  certificates: { courseId: string; courseTitle: string }[];
};

function scoreLabel(total: number | null, max: number | null): string {
  if (total != null && max != null) return `${total} / ${max}`;
  return "—";
}

function BentoCard({
  className,
  children,
  delay = 0,
}: {
  className?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("surface-bento", className)}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={reduce ? undefined : { type: "spring", stiffness: 400, damping: 30, delay }}
      whileHover={reduce ? undefined : { y: -2, transition: { type: "spring", stiffness: 500, damping: 28 } }}
    >
      {children}
    </motion.div>
  );
}

export function DashboardBento(props: DashboardBentoProps) {
  const base = `/o/${props.slug}`;
  const reduce = useReducedMotion();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.div
        className="surface-bento relative overflow-hidden p-6 md:p-8"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
      >
        <div
          className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-glow-spot opacity-50 blur-3xl dark:opacity-70"
          aria-hidden
        />
        <h1 className="text-2xl font-semibold tracking-tighter md:text-3xl">Dashboard</h1>
        {props.cmsWelcome ? (
          <p className="mt-3 text-lg font-medium tracking-tight text-foreground md:text-xl">{props.cmsWelcome}</p>
        ) : null}
        {props.cmsSubtitle ? (
          <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {props.cmsSubtitle}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{props.userEmail}</span> (
          {props.userRole.toLowerCase()}) in {props.orgName}.
        </p>
      </motion.div>

      <BentoCard className="p-6 md:p-7" delay={0.02}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/15">
            <Home className="size-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">School home</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Public family page</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Open the one-page site with hero, admissions, about us (and optional video), gallery, and contacts. School
              admins manage copy and hero/video in <span className="font-medium text-foreground">Admin → CMS</span> and the
              default hero image in <span className="font-medium text-foreground">School settings</span>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/school/${props.slug}`}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "default" }), "gap-2")}
              >
                View public page
              </Link>
              {props.userRole === "ADMIN" ? (
                <Link href={`${base}/admin/cms`} className={cn(buttonVariants({ variant: "outline" }))}>
                  Edit in CMS
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </BentoCard>

      <div className="grid auto-rows-fr gap-4 md:grid-cols-4">
        <BentoCard className="p-5 md:col-span-1" delay={0.03}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My courses</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{props.enrollmentTotal}</p>
          <p className="mt-1 text-xs text-muted-foreground">Enrolled (showing up to 6)</p>
        </BentoCard>
        <BentoCard className="p-5 md:col-span-1" delay={0.06}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quizzes live</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{props.publishedAssessments}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {props.studentScopedAssessments ? "In your enrolled courses" : "Across your organization"}
          </p>
        </BentoCard>
        {props.staff ? (
          <BentoCard className="p-5 md:col-span-2" delay={0.09}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your catalog</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{props.teachingCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {props.draftCourses} draft{props.draftCourses === 1 ? "" : "s"}
            </p>
          </BentoCard>
        ) : (
          <BentoCard className="p-5 md:col-span-2" delay={0.09}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick tip</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Press <kbd className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs">⌘K</kbd> to
              search and jump anywhere.
            </p>
          </BentoCard>
        )}
      </div>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <BentoCard className="flex flex-col p-0" delay={0.04}>
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 dark:border-white/10">
            <MessagesSquare className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">School wall</h2>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            {props.recentSchoolMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing posted yet. Say hello to everyone in your school — students, teachers, and admins share this
                thread.
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {props.recentSchoolMessages.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`${base}/messages`}
                      className="block rounded-lg border border-transparent px-1 py-0.5 transition-colors hover:border-border/80 hover:bg-muted/30 dark:hover:border-white/10"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-muted-foreground">{m.authorLabel}</p>
                        {m.isPlatform ? (
                          <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                            Platform
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-foreground">{m.bodyPreview}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`${base}/messages`}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-auto w-full justify-center")}
            >
              Open messages
            </Link>
          </div>
        </BentoCard>

        <BentoCard className="flex flex-col p-0" delay={0.05}>
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 dark:border-white/10">
            <MessageCircle className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">Course discussions</h2>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            {props.recentDiscussions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {props.staff
                  ? "No discussion posts yet. Chat appears on each course page."
                  : "Enroll in a course to see and join discussions."}
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {props.recentDiscussions.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`${base}/courses/${m.courseId}#course-discussion`}
                      className="block rounded-lg border border-transparent px-1 py-0.5 transition-colors hover:border-border/80 hover:bg-muted/30 dark:hover:border-white/10"
                    >
                      <p className="text-xs text-muted-foreground">
                        {m.courseTitle} · {m.authorLabel}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-foreground">{m.bodyPreview}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`${base}/courses`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-auto w-full justify-center")}
            >
              Go to courses
            </Link>
          </div>
        </BentoCard>

        <BentoCard className="flex flex-col p-0" delay={0.07}>
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 dark:border-white/10">
            <FileChartColumn className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">Report card</h2>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            {props.reportPreview.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No graded submissions yet. Complete assessments from your courses to build your report card.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {props.reportPreview.map((r) => (
                  <li key={r.submissionId}>
                    <Link
                      href={`${base}/courses/${r.courseId}/assessments/${r.assessmentId}/results?submissionId=${encodeURIComponent(r.submissionId)}`}
                      className="block rounded-lg border border-transparent px-1 py-1 transition-colors hover:border-border/80 hover:bg-muted/30 dark:hover:border-white/10"
                    >
                      <p className="font-medium leading-tight">{r.assessmentTitle}</p>
                      <p className="text-xs text-muted-foreground">{r.courseTitle}</p>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                        Score {scoreLabel(r.totalScore, r.maxScore)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`${base}/report-card`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-auto w-full justify-center")}
            >
              Full report card
            </Link>
          </div>
        </BentoCard>

        <BentoCard className="flex flex-col p-0" delay={0.09}>
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 dark:border-white/10">
            <Award className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">Certificates</h2>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            {props.staff ? (
              <p className="text-sm text-muted-foreground">
                Completion certificates are for students who finish all lessons in a course. See the Certificates page
                for details.
              </p>
            ) : props.certificates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Complete every lesson in an enrolled course to unlock a certificate of completion.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {props.certificates.slice(0, 4).map((c) => (
                  <li key={c.courseId}>
                    <Link
                      href={`${base}/courses/${c.courseId}/certificate`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-1 py-1.5 transition-colors hover:border-border/80 hover:bg-muted/30 dark:hover:border-white/10"
                    >
                      <span className="min-w-0 truncate font-medium">{c.courseTitle}</span>
                      <span className="shrink-0 text-xs font-medium text-primary">View</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`${base}/certificates`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-auto w-full justify-center")}
            >
              All certificates
            </Link>
          </div>
        </BentoCard>
      </section>

      {props.enrollments.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="surface-bento lg:col-span-2">
            <h2 className="border-b border-border/60 px-5 py-4 text-sm font-semibold tracking-tight dark:border-white/10">
              Continue learning
            </h2>
            <ul className="divide-y divide-border/60 dark:divide-white/10">
              {props.enrollments.map((e, i) => (
                <li key={e.id} className={cn(i === 0 && "bento-course-active")}>
                  <Link
                    href={`${base}/courses/${e.course.id}`}
                    className="relative flex items-center justify-between gap-3 px-5 py-4 text-sm transition-colors hover:bg-muted/30"
                  >
                    <span className="min-w-0 truncate font-medium tracking-tight">{e.course.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(e.progressPercent)}%</span>
                  </Link>
                  <div className="px-5 pb-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={reduce ? undefined : { width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, e.progressPercent))}%` }}
                        transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.15 + i * 0.05 }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <motion.div
            className="surface-bento flex flex-col gap-2 p-5"
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={reduce ? undefined : { opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32, delay: 0.12 }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shortcuts</p>
            <div className="mt-2 flex flex-col gap-2">
              <Link href={`${base}/messages`} className={cn(buttonVariants(), "justify-center tracking-tight")}>
                Messages
              </Link>
              <Link href={`${base}/courses`} className={cn(buttonVariants({ variant: "outline" }), "justify-center tracking-tight")}>
                Courses
              </Link>
              <Link href={`${base}/assessments`} className={cn(buttonVariants({ variant: "outline" }), "justify-center")}>
                Assessments
              </Link>
              <Link href={`${base}/report-card`} className={cn(buttonVariants({ variant: "outline" }), "justify-center")}>
                Report card
              </Link>
              <Link href={`${base}/certificates`} className={cn(buttonVariants({ variant: "outline" }), "justify-center")}>
                Certificates
              </Link>
              <Link href={`${base}/settings`} className={cn(buttonVariants({ variant: "secondary" }), "justify-center")}>
                Settings
              </Link>
              <Link href={`${base}/blog`} className={cn(buttonVariants({ variant: "outline" }), "justify-center")}>
                Blog
              </Link>
              <Link href={`${base}/library`} className={cn(buttonVariants({ variant: "outline" }), "justify-center")}>
                Library
              </Link>
            </div>
          </motion.div>
        </section>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/courses`} className={cn(buttonVariants())}>
            Browse courses
          </Link>
          <Link href={`${base}/library`} className={cn(buttonVariants({ variant: "outline" }))}>
            Library
          </Link>
        </div>
      )}
    </div>
  );
}
