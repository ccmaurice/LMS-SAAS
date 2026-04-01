import { prisma } from "@/lib/db";

export async function countCompletedAttempts(assessmentId: string, userId: string): Promise<number> {
  return prisma.submission.count({
    where: {
      assessmentId,
      userId,
      status: { in: ["SUBMITTED", "GRADED"] },
    },
  });
}

export async function findActiveDraft(assessmentId: string, userId: string) {
  return prisma.submission.findFirst({
    where: { assessmentId, userId, status: "DRAFT" },
    orderBy: { startedAt: "desc" },
  });
}

export async function findLatestSubmission(assessmentId: string, userId: string) {
  return prisma.submission.findFirst({
    where: { assessmentId, userId },
    orderBy: { startedAt: "desc" },
  });
}

export async function consumeNextApprovedRetakeGrant(assessmentId: string, userId: string) {
  const grant = await prisma.assessmentRetakeRequest.findFirst({
    where: { assessmentId, userId, status: "APPROVED", consumedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!grant) return null;
  await prisma.assessmentRetakeRequest.update({
    where: { id: grant.id },
    data: { consumedAt: new Date() },
  });
  return grant.id;
}

export type StartAttemptResult =
  | { kind: "draft"; submission: { id: string; startedAt: Date; status: string } }
  | { kind: "new"; submission: { id: string; startedAt: Date; status: string } }
  | {
      kind: "locked";
      submission: { id: string; startedAt: Date; status: string };
      needsRetakeApproval: boolean;
      completedAttempts: number;
      maxAttempts: number;
    };

export async function resolveStudentStartAttempt(
  assessmentId: string,
  userId: string,
  opts: {
    maxAttemptsPerStudent: number;
    retakeRequiresApproval: boolean;
  },
): Promise<StartAttemptResult> {
  const draft = await findActiveDraft(assessmentId, userId);
  if (draft) {
    return { kind: "draft", submission: draft };
  }

  const completed = await countCompletedAttempts(assessmentId, userId);
  const latest = await findLatestSubmission(assessmentId, userId);

  if (completed < opts.maxAttemptsPerStudent) {
    const submission = await prisma.submission.create({
      data: { assessmentId, userId, status: "DRAFT" },
    });
    return { kind: "new", submission };
  }

  if (opts.retakeRequiresApproval) {
    const grantId = await consumeNextApprovedRetakeGrant(assessmentId, userId);
    if (grantId) {
      const submission = await prisma.submission.create({
        data: { assessmentId, userId, status: "DRAFT" },
      });
      return { kind: "new", submission };
    }
  }

  const lockedSubmission =
    latest ??
    (await prisma.submission.findFirst({
      where: { assessmentId, userId, status: { in: ["SUBMITTED", "GRADED"] } },
      orderBy: { submittedAt: "desc" },
    }));

  if (!lockedSubmission) {
    const submission = await prisma.submission.create({
      data: { assessmentId, userId, status: "DRAFT" },
    });
    return { kind: "new", submission };
  }

  return {
    kind: "locked",
    submission: lockedSubmission,
    needsRetakeApproval: opts.retakeRequiresApproval,
    completedAttempts: completed,
    maxAttempts: opts.maxAttemptsPerStudent,
  };
}
