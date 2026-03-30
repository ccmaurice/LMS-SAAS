import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canEditCourseAsStaff, getEnrollment, isStaffRole } from "@/lib/courses/access";
import { EnrollButton } from "@/components/courses/enroll-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { CourseChatPanel } from "@/components/courses/course-chat-panel";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
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

  const enrollment = await getEnrollment(user.id, courseId);
  const staff = isStaffRole(user.role);
  const preview = !staff && !enrollment && user.role === "STUDENT" && course.published;

  if (!staff && !enrollment && !(user.role === "STUDENT" && course.published)) {
    notFound();
  }

  const progressIds = enrollment
    ? (
        await prisma.lessonProgress.findMany({
          where: { userId: user.id, lesson: { module: { courseId } } },
          select: { lessonId: true },
        })
      ).map((p) => p.lessonId)
    : [];

  const base = `/o/${slug}/courses/${courseId}`;
  const canEdit = canEditCourseAsStaff(user.role);
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const certsPublished = orgBranding?.certificatesPublished !== false;
  const eligibleForCertificate =
    !!enrollment &&
    !staff &&
    certsPublished &&
    allLessons.length > 0 &&
    allLessons.every((l) => progressIds.includes(l.id));

  return (
    <div className="space-y-8">
      <div className="surface-bento p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
              <Badge variant={course.published ? "default" : "secondary"}>
                {course.published ? "Published" : "Draft"}
              </Badge>
              {preview ? <Badge variant="outline">Preview — enroll for full content</Badge> : null}
            </div>
            {course.description ? (
              <p className="mt-2 max-w-2xl whitespace-pre-wrap text-muted-foreground">{course.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`${base}/assessments`} className={cn(buttonVariants({ variant: "secondary" }))}>
              Assessments
            </Link>
            {eligibleForCertificate ? (
              <Link href={`${base}/certificate`} className={cn(buttonVariants({ variant: "default" }))}>
                Certificate
              </Link>
            ) : null}
            {canEdit ? (
              <Link href={`${base}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
                Edit structure
              </Link>
            ) : null}
            {!staff && course.published ? <EnrollButton courseId={courseId} enrolled={!!enrollment} /> : null}
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Curriculum</h2>
        <div className="grid gap-4 md:grid-cols-12">
          {course.modules.map((mod, mi) => (
            <div key={mod.id} className={cn("surface-bento p-5", mi === 0 ? "md:col-span-7" : "md:col-span-5")}>
              <h3 className="font-semibold tracking-tight">{mod.title}</h3>
              <ul className="mt-3 space-y-1 border-l-2 border-border/80 pl-4 dark:border-white/10">
                {mod.lessons.map((lesson) => {
                  const done = progressIds.includes(lesson.id);
                  const canOpen = staff || enrollment || preview;
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
            No modules yet. {canEdit ? "Use Edit structure to add some." : ""}
          </p>
        ) : null}
      </section>

      {staff || enrollment ? <CourseChatPanel courseId={courseId} /> : null}
    </div>
  );
}
