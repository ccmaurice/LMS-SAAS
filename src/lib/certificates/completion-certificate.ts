import { prisma } from "@/lib/db";

export async function ensureCourseCompletionCertificate(params: {
  organizationId: string;
  userId: string;
  courseId: string;
  issuedAt: Date;
}): Promise<{ id: string; issuedAt: Date }> {
  const row = await prisma.courseCompletionCertificate.upsert({
    where: {
      userId_courseId: { userId: params.userId, courseId: params.courseId },
    },
    create: {
      organizationId: params.organizationId,
      userId: params.userId,
      courseId: params.courseId,
      issuedAt: params.issuedAt,
    },
    update: { updatedAt: new Date() },
    select: { id: true, issuedAt: true },
  });
  return row;
}

export type PublicCertificateVerification =
  | {
      ok: true;
      schoolName: string;
      courseTitle: string;
      recipientDisplayName: string;
      issuedAt: Date;
    }
  | { ok: false };

/** Public lookup: slug must match issuing school (ACTIVE). */
export async function verifyCompletionCertificatePublic(
  organizationSlug: string,
  credentialId: string,
): Promise<PublicCertificateVerification> {
  const id = credentialId.trim();
  if (!id || id.length > 36) {
    return { ok: false };
  }

  const row = await prisma.courseCompletionCertificate.findFirst({
    where: {
      id,
      organization: { slug: organizationSlug, status: "ACTIVE" },
    },
    include: {
      organization: { select: { name: true } },
      course: { select: { title: true, organizationId: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!row || row.course.organizationId !== row.organizationId) {
    return { ok: false };
  }

  const recipientDisplayName = row.user.name?.trim() || row.user.email;

  return {
    ok: true,
    schoolName: row.organization.name,
    courseTitle: row.course.title,
    recipientDisplayName,
    issuedAt: row.issuedAt,
  };
}

export function completionCertificateVerifyPath(slug: string, credentialId: string): string {
  const q = new URLSearchParams({ id: credentialId });
  return `/school/${encodeURIComponent(slug)}/verify-certificate?${q.toString()}`;
}
