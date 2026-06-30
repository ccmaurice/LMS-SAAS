import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { courseWhereTeacherAssessmentAccess } from "@/lib/assessments/staff-access";
import { getServerT } from "@/i18n/server";
import Link from "next/link";
import { ShieldAlert, Lock, AlertTriangle, Eye, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

export default async function ProctoringDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) {
    redirect(`/o/${slug}/dashboard`);
  }

  // Get teacher accessible courses or all for admin
  const teacherCoursesWhere = user.role === "TEACHER"
    ? courseWhereTeacherAssessmentAccess(user.organizationId, user.id)
    : { organizationId: user.organizationId };

  // Fetch all published assessments
  const assessments = await prisma.assessment.findMany({
    where: {
      published: true,
      course: teacherCoursesWhere,
    },
    include: {
      course: { select: { id: true, title: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const assessmentIds = assessments.map((a) => a.id);

  // Fetch recent proctoring events
  const recentEvents = await prisma.proctoringEvent.findMany({
    where: {
      organizationId: user.organizationId,
      assessmentId: user.role === "TEACHER" ? { in: assessmentIds } : { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // Fetch statistics
  const [totalAlertsCount, lockdownExamsCount, secureExamsCount] = await Promise.all([
    prisma.proctoringEvent.count({
      where: {
        organizationId: user.organizationId,
        assessmentId: user.role === "TEACHER" ? { in: assessmentIds } : undefined,
        dismissedAt: null,
      },
    }),
    prisma.assessment.count({
      where: {
        deliveryMode: "LOCKDOWN",
        published: true,
        course: teacherCoursesWhere,
      },
    }),
    prisma.assessment.count({
      where: {
        deliveryMode: "SECURE_ONLINE",
        published: true,
        course: teacherCoursesWhere,
      },
    }),
  ]);

  const assessmentMap = new Map(assessments.map((a) => [a.id, a]));

  return (
    <div className="space-y-8 pb-12 text-left">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="page-title">Exam Proctoring &amp; Integrity Center</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor active proctored assessments, review security logs, and audit student attempt behaviors.
            </p>
          </div>
        </div>
      </div>

      {/* Bento Grid Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-bento border-border/60 p-5 dark:border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lockdown Mode Exams</p>
            <p className="text-2xl font-bold mt-1 text-foreground tabular-nums">{lockdownExamsCount}</p>
          </div>
          <div className="p-3 bg-red-500/10 text-red-500 rounded-lg">
            <Lock className="w-5 h-5" />
          </div>
        </div>
        <div className="surface-bento border-border/60 p-5 dark:border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Secure Online Exams</p>
            <p className="text-2xl font-bold mt-1 text-foreground tabular-nums">{secureExamsCount}</p>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
            <Eye className="w-5 h-5" />
          </div>
        </div>
        <div className="surface-bento border-border/60 p-5 dark:border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unexcused Logs</p>
            <p className="text-2xl font-bold mt-1 text-amber-500 tabular-nums">{totalAlertsCount}</p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Active Proctored Exams (Left 7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-base font-bold text-foreground">Proctored Assessments</h2>
          <div className="surface-bento border-border/60 dark:border-white/10 overflow-hidden">
            {assessments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No active proctored assessments found.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {assessments.map((a) => (
                  <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/5 transition-all">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.course.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded border uppercase shrink-0",
                        a.deliveryMode === "LOCKDOWN" 
                          ? "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
                          : a.deliveryMode === "SECURE_ONLINE"
                            ? "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400"
                            : "border-border/60 bg-muted/10 text-muted-foreground"
                      )}>
                        {a.deliveryMode}
                      </span>
                      {a.deliveryMode !== "FORMATIVE" && (
                        <Link
                          href={`/o/${slug}/courses/${a.course.id}/assessments/${a.id}/integrity`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs h-8 shrink-0")}
                        >
                          View Logs <ArrowUpRight className="w-3 h-3 ml-1" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Integrity Alert Feed (Right 5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-base font-bold text-foreground">Recent Security Alerts</h2>
          <div className="surface-bento border-border/60 dark:border-white/10 p-4 space-y-4">
            {recentEvents.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                No recent security events logged.
              </div>
            ) : (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {recentEvents.map((evt) => {
                  const matchingAss = evt.assessmentId ? assessmentMap.get(evt.assessmentId) : null;
                  const isExcused = evt.dismissedAt != null;

                  return (
                    <div key={evt.id} className="text-xs border-b border-border/40 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground truncate max-w-[150px]">
                          {evt.user.name || evt.user.email}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {new Date(evt.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 font-medium truncate">
                        {matchingAss?.title || "Assessment"}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={cn(
                          "inline-flex items-center gap-1 font-semibold text-[10px] uppercase px-1.5 py-0.5 rounded border",
                          isExcused 
                            ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
                            : "border-red-500/20 bg-red-500/5 text-red-600"
                        )}>
                          {isExcused ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {evt.eventType.replace(/_/g, " ")}
                        </span>
                        {matchingAss && (
                          <Link
                            href={`/o/${slug}/courses/${matchingAss.course.id}/assessments/${evt.assessmentId}/integrity?student=${encodeURIComponent(evt.user.email)}`}
                            className="text-[10px] text-primary hover:underline font-semibold"
                          >
                            Investigate
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
