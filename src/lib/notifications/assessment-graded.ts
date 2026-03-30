import { prisma } from "@/lib/db";

/** Notify the student when their submission first becomes GRADED. */
export async function notifySubmissionGradedIfNew(submissionId: string, wasAlreadyGraded: boolean) {
  if (wasAlreadyGraded) return;

  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      status: true,
      userId: true,
      assessmentId: true,
      assessment: {
        select: {
          title: true,
          courseId: true,
          course: { select: { organization: { select: { slug: true } } } },
        },
      },
    },
  });

  if (!sub || sub.status !== "GRADED") return;

  const slug = sub.assessment.course.organization.slug;
  const { courseId } = sub.assessment;
  const link = `/o/${slug}/courses/${courseId}/assessments/${sub.assessmentId}/results?submissionId=${submissionId}`;

  await prisma.notification.create({
    data: {
      userId: sub.userId,
      title: "Assessment graded",
      body: `${sub.assessment.title} has been fully graded.`,
      link,
    },
  });
}
