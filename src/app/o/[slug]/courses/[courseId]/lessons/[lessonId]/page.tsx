import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getEnrollment, isStaffRole } from "@/lib/courses/access";
import { MarkLessonCompleteButton } from "@/components/courses/mark-lesson-complete";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string; lessonId: string }>;
}) {
  const { slug, courseId, lessonId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { courseId, course: { organizationId: user.organizationId } } },
    include: {
      module: { select: { id: true, title: true } },
      files: true,
    },
  });

  if (!lesson) notFound();

  const course = await prisma.course.findFirst({
    where: { id: courseId, organizationId: user.organizationId },
    select: { published: true, title: true },
  });
  if (!course) notFound();

  const enrollment = await getEnrollment(user.id, courseId);
  const staff = isStaffRole(user.role);
  const preview = !staff && !enrollment && user.role === "STUDENT" && course.published;

  if (!staff && !enrollment && !(user.role === "STUDENT" && course.published)) {
    notFound();
  }

  const completed =
    enrollment &&
    (await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId } },
    }));

  const base = `/o/${slug}/courses/${courseId}`;

  if (preview) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          ← Back to course
        </Link>
        <div className="surface-bento p-6">
          <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
          <p className="mt-2 text-muted-foreground">Enroll in this course to view lesson content and track progress.</p>
          <Link href={base} className={cn(buttonVariants(), "mt-6 inline-flex")}>
            Back to course to enroll
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          ← {course.title}
        </Link>
        {staff ? (
          <Link href={`${base}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Edit in builder
          </Link>
        ) : null}
      </div>
      <div className="surface-bento space-y-6 p-6">
        <div>
          <p className="text-sm text-muted-foreground">{lesson.module.title}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
        </div>
        {lesson.videoUrl ? (
          lesson.videoUrl.includes("/embed/") ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/80 bg-muted dark:border-white/10">
              <iframe title="Video" src={lesson.videoUrl} className="h-full w-full" allowFullScreen />
            </div>
          ) : (
            <a
              href={lesson.videoUrl}
              className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Open video link
            </a>
          )
        ) : null}
        {lesson.content ? (
          <div className="max-w-none text-sm leading-relaxed whitespace-pre-wrap">{lesson.content}</div>
        ) : (
          <p className="text-sm text-muted-foreground">No written content for this lesson.</p>
        )}
        {lesson.files.length > 0 ? (
          <div>
            <p className="text-sm font-medium">Attachments</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {lesson.files.map((f) => {
                const internal = f.url.startsWith("/api/");
                return (
                  <li key={f.id}>
                    <a
                      href={f.url}
                      className="text-primary underline-offset-4 hover:underline"
                      {...(internal ? {} : { target: "_blank", rel: "noreferrer" })}
                    >
                      {f.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {enrollment ? <MarkLessonCompleteButton lessonId={lessonId} completed={!!completed} /> : null}
      </div>
    </div>
  );
}
