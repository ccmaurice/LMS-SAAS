import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canTeacherManageCourse, resolveCourseLearnerAccess } from "@/lib/courses/access";
import { getServerT } from "@/i18n/server";
import { EnrollButton } from "@/components/courses/enroll-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { CourseChatPanel } from "@/components/courses/course-chat-panel";
import { assessmentOutcomeNeedsAttention } from "@/lib/assessments/assessment-outcome-health";
import { submitParticipationPercent, summarizeOutcomeSubmissions } from "@/lib/assessments/course-assessment-outcomes";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }

  const [course, orgBranding] = await Promise.all([
    prisma.course.findFirst({
      where: { id: courseId, organizationId: user.organizationId },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: { lessons: { orderBy: { order: "asc" } } },
        },
      },
    }),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { certificatesPublished: true },
    }),
  ]);

  if (!course) notFound();

  const gate = await resolveCourseLearnerAccess(user, courseId, course.published);
  if (!gate.canAccess) notFound();

  const { enrollment, staff, preview, parentViaChild } = gate;

  const progressIds =
    enrollment || parentViaChild
      ? (
          await prisma.lessonProgress.findMany({
            where: { userId: gate.progressUserId, lesson: { module: { courseId } } },
            select: { lessonId: true },
          })
        ).map((p) => p.lessonId)
      : [];

  const base = `/o/${slug}/courses/${courseId}`;
  const canEdit = canTeacherManageCourse(user, course.createdById);
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const certsPublished = orgBranding?.certificatesPublished !== false;
  const lessonsComplete =
    allLessons.length > 0 && allLessons.every((l) => progressIds.includes(l.id));
  const eligibleForCertificate =
    !staff &&
    certsPublished &&
    lessonsComplete &&
    (!!enrollment || parentViaChild);

  let attentionPublishedCount = 0;
  if (canEdit) {
    const [enrolledForOutcomes, publishedForRollup] = await Promise.all([
      prisma.enrollment.count({ where: { courseId } }),
      prisma.assessment.findMany({
        where: { courseId, published: true },
        select: {
          submissions: {
            where: { status: "SUBMITTED" },
            select: { totalScore: true, maxScore: true, userId: true },
          },
        },
      }),
    ]);
    for (const a of publishedForRollup) {
      const s = summarizeOutcomeSubmissions(a.submissions);
      const p = submitParticipationPercent(s.distinctStudents, enrolledForOutcomes);
      if (
        assessmentOutcomeNeedsAttention({
          published: true,
          mean: s.mean,
          scoredAttemptCount: s.scoredAttemptCount,
          participationPercent: p,
          enrolledCount: enrolledForOutcomes,
        })
      ) {
        attentionPublishedCount += 1;
      }
    }
  }

  return (
    <div className="space-y-8">
      <div className="surface-bento p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{course.title}</h1>
              <Badge variant={course.published ? "default" : "secondary"}>
                {course.published ? t("courses.published") : t("courses.draft")}
              </Badge>
              {preview ? <Badge variant="outline">{t("courses.previewBadge")}</Badge> : null}
              {parentViaChild ? <Badge variant="outline">{t("courses.parentViewingBadge")}</Badge> : null}
            </div>
            {course.description ? (
              <p className="mt-2 max-w-2xl whitespace-pre-wrap text-muted-foreground">{course.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`${base}/assessments`} className={cn(buttonVariants({ variant: "secondary" }))}>
              {t("nav.assessments")}
            </Link>
            {canEdit ? (
              <Link
                href={`${base}/assessment-outcomes`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                {t("courses.assessmentOutcomes")}
              </Link>
            ) : null}
            {eligibleForCertificate ? (
              <Link
                href={`${base}/certificate${parentViaChild ? `?child=${encodeURIComponent(gate.progressUserId)}` : ""}`}
                className={cn(buttonVariants({ variant: "default" }))}
              >
                {t("courses.certificate")}
              </Link>
            ) : null}
            {canEdit ? (
              <Link href={`${base}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
                {t("courses.editStructure")}
              </Link>
            ) : null}
            {!staff && course.published && !parentViaChild ? (
              <EnrollButton courseId={courseId} enrolled={!!enrollment} />
            ) : null}
          </div>
        </div>
      </div>

      {canEdit && attentionPublishedCount > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <span className="font-medium">
            {t(attentionPublishedCount === 1 ? "courses.attentionOne" : "courses.attentionMany").replace(
              "%s",
              String(attentionPublishedCount),
            )}
          </span>{" "}
          <Link
            href={`${base}/assessment-outcomes?attention=flagged`}
            className="font-medium text-primary underline underline-offset-2"
          >
            {t("courses.reviewOutcomes")}
          </Link>
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("courses.curriculum")}</h2>
        <div className="grid gap-4 md:grid-cols-12">
          {course.modules.map((mod, mi) => (
            <div key={mod.id} className={cn("surface-bento p-5", mi === 0 ? "md:col-span-7" : "md:col-span-5")}>
              <h3 className="font-semibold tracking-tight">{mod.title}</h3>
              <ul className="mt-3 space-y-1 border-l-2 border-border/80 pl-4 dark:border-white/10">
                {mod.lessons.map((lesson) => {
                  const done = progressIds.includes(lesson.id);
                  const canOpen = staff || enrollment || preview || parentViaChild;
                  return (
                    <li key={lesson.id}>
                      {canOpen ? (
                        <Link
                          href={`${base}/lessons/${lesson.id}`}
                          className="text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {lesson.title}
                          {done ? " ✓" : ""}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">{lesson.title}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {course.modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canEdit ? t("courses.noModulesStaff") : t("courses.noModulesLearner")}
          </p>
        ) : null}
      </section>

      {staff || enrollment ? <CourseChatPanel courseId={courseId} /> : null}
    </div>
  );
}
