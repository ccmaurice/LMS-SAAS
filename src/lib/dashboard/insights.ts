import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/courses/access";

const DISCUSSION_PREVIEW_LEN = 72;

export type RecentDiscussionMessage = {
  id: string;
  bodyPreview: string;
  createdAt: Date;
  authorLabel: string;
  courseId: string;
  courseTitle: string;
};

export async function getRecentDiscussionMessages(args: {
  userId: string;
  organizationId: string;
  role: Role;
  take?: number;
}): Promise<RecentDiscussionMessage[]> {
  const take = args.take ?? 6;

  const rows = await prisma.courseChatMessage.findMany({
    where: {
      course: {
        organizationId: args.organizationId,
        ...(args.role === "STUDENT"
          ? { enrollments: { some: { userId: args.userId } } }
          : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
  });

  return rows.map((m) => {
    const raw = m.body.replace(/\s+/g, " ").trim();
    const bodyPreview =
      raw.length > DISCUSSION_PREVIEW_LEN ? `${raw.slice(0, DISCUSSION_PREVIEW_LEN)}…` : raw;
    return {
      id: m.id,
      bodyPreview,
      createdAt: m.createdAt,
      authorLabel: m.user.name?.trim() || m.user.email,
      courseId: m.course.id,
      courseTitle: m.course.title,
    };
  });
}

export type ReportCardRow = {
  submissionId: string;
  assessmentId: string;
  assessmentTitle: string;
  courseId: string;
  courseTitle: string;
  assessmentKind: string;
  semester: number | null;
  gradingScale: string;
  totalScore: number | null;
  maxScore: number | null;
  status: string;
  submittedAt: Date | null;
};

export async function getUserReportCardRows(
  userId: string,
  organizationId: string,
  role: Role,
): Promise<ReportCardRow[]> {
  if (role === "STUDENT") {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { reportCardsPublished: true },
    });
    if (!org?.reportCardsPublished) {
      return [];
    }
  }

  const subs = await prisma.submission.findMany({
    where: {
      userId,
      submittedAt: { not: null },
      status: { in: ["SUBMITTED", "GRADED"] },
      assessment: { course: { organizationId } },
    },
    orderBy: { submittedAt: "desc" },
    take: 80,
    include: {
      assessment: {
        select: {
          id: true,
          title: true,
          kind: true,
          semester: true,
          course: { select: { id: true, title: true, gradingScale: true } },
        },
      },
    },
  });

  return subs.map((s) => ({
    submissionId: s.id,
    assessmentId: s.assessment.id,
    assessmentTitle: s.assessment.title,
    courseId: s.assessment.course.id,
    courseTitle: s.assessment.course.title,
    assessmentKind: s.assessment.kind,
    semester: s.assessment.semester,
    gradingScale: s.assessment.course.gradingScale,
    totalScore: s.totalScore,
    maxScore: s.maxScore,
    status: s.status,
    submittedAt: s.submittedAt,
  }));
}

export async function getUserPromotionSnapshot(userId: string, organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { academicYearLabel: true },
  });
  if (!org) return null;
  return prisma.studentPromotionSnapshot.findUnique({
    where: {
      organizationId_userId_academicYearLabel: {
        organizationId,
        userId,
        academicYearLabel: org.academicYearLabel,
      },
    },
  });
}

export type CertificateEligible = {
  courseId: string;
  courseTitle: string;
};

/** Courses where the user has an enrollment, is not staff-only (certificate page blocks staff), and completed every lesson. */
export async function getEligibleCertificates(
  userId: string,
  organizationId: string,
  role: Role,
): Promise<CertificateEligible[]> {
  if (isStaffRole(role)) {
    return [];
  }

  const orgPub = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { certificatesPublished: true },
  });
  if (!orgPub?.certificatesPublished) {
    return [];
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId, course: { organizationId } },
    include: {
      course: {
        include: {
          modules: { include: { lessons: { select: { id: true } } } },
        },
      },
    },
  });

  const eligible: CertificateEligible[] = [];

  for (const e of enrollments) {
    const lessonIds = e.course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    if (lessonIds.length === 0) continue;

    const progress = await prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    });
    const done = new Set(progress.map((p) => p.lessonId));
    const allDone = lessonIds.every((id) => done.has(id));
    if (allDone) {
      eligible.push({ courseId: e.course.id, courseTitle: e.course.title });
    }
  }

  return eligible;
}

export type RecentSchoolMessage = {
  id: string;
  bodyPreview: string;
  createdAt: Date;
  authorLabel: string;
  isPlatform: boolean;
};

export async function getRecentSchoolMessages(organizationId: string, take = 6): Promise<RecentSchoolMessage[]> {
  const rows = await prisma.organizationMessage.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true, email: true } } },
  });

  return rows.map((m) => {
    const raw = m.body.replace(/\s+/g, " ").trim();
    const bodyPreview =
      raw.length > DISCUSSION_PREVIEW_LEN ? `${raw.slice(0, DISCUSSION_PREVIEW_LEN)}…` : raw;
    const authorLabel =
      m.senderKind === "PLATFORM"
        ? `Platform · ${m.platformEmail ?? "operator"}`
        : m.user?.name?.trim() || m.user?.email || "Member";
    return {
      id: m.id,
      bodyPreview,
      createdAt: m.createdAt,
      authorLabel,
      isPlatform: m.senderKind === "PLATFORM",
    };
  });
}
