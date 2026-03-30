import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCourseInOrg } from "@/lib/assessments/access";
import { getEnrollment, isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function CourseAssessmentsPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const course = await assertCourseInOrg(courseId, user.organizationId);
  if (!course) notFound();

  const base = `/o/${slug}/courses/${courseId}/assessments`;

  if (isStaffRole(user.role)) {
    const assessments = await prisma.assessment.findMany({
      where: { courseId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { questions: true, submissions: true } } },
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
            <p className="text-muted-foreground">{course.title}</p>
          </div>
          <Link href={`${base}/new`} className={cn(buttonVariants())}>
            New assessment
          </Link>
        </div>
        <ul className="space-y-3">
          {assessments.map((a) => (
            <li key={a.id} className="surface-bento flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground">
                  {a._count.questions} questions · {a._count.submissions} submissions
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={a.published ? "default" : "secondary"}>
                  {a.published ? "Published" : "Draft"}
                </Badge>
                <Link href={`${base}/${a.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Edit
                </Link>
                <Link href={`${base}/${a.id}/gradebook`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                  Gradebook
                </Link>
              </div>
            </li>
          ))}
        </ul>
        {assessments.length === 0 ? <p className="text-muted-foreground">No assessments yet.</p> : null}
        <Link href={`/o/${slug}/courses/${courseId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          ← Back to course
        </Link>
      </div>
    );
  }

  const enrolled = await getEnrollment(user.id, courseId);
  if (!enrolled) {
    return (
      <p className="text-muted-foreground">
        Enroll in this course to see assessments.{" "}
        <Link href={`/o/${slug}/courses/${courseId}`} className="text-primary underline">
          Course page
        </Link>
      </p>
    );
  }

  const assessments = await prisma.assessment.findMany({
    where: { courseId, published: true },
    orderBy: { title: "asc" },
    include: { _count: { select: { questions: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
      <p className="text-muted-foreground">{course.title}</p>
      <ul className="space-y-3">
        {assessments.map((a) => (
          <li key={a.id} className="surface-bento flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="text-sm text-muted-foreground">{a._count.questions} questions</p>
            </div>
            <Link href={`${base}/${a.id}/take`} className={cn(buttonVariants())}>
              Start
            </Link>
          </li>
        ))}
      </ul>
      {assessments.length === 0 ? <p className="text-muted-foreground">No published assessments.</p> : null}
      <Link href={`/o/${slug}/courses/${courseId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        ← Back to course
      </Link>
    </div>
  );
}
