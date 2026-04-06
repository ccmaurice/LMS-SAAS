import { describe, expect, it, vi, beforeEach } from "vitest";

const { courseChatFindMany } = vi.hoisted(() => ({
  courseChatFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    courseChatMessage: { findMany: courseChatFindMany },
  },
}));

import { getRecentDiscussionMessages } from "@/lib/dashboard/insights";

describe("getRecentDiscussionMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    courseChatFindMany.mockResolvedValue([]);
  });

  it("returns empty for PARENT with no linked students without querying", async () => {
    const r = await getRecentDiscussionMessages({
      userId: "parent1",
      organizationId: "org1",
      role: "PARENT",
      linkedStudentUserIds: [],
    });
    expect(r).toEqual([]);
    expect(courseChatFindMany).not.toHaveBeenCalled();
  });

  it("scopes PARENT to courses where linked students are enrolled", async () => {
    await getRecentDiscussionMessages({
      userId: "parent1",
      organizationId: "org1",
      role: "PARENT",
      linkedStudentUserIds: ["stu_a", "stu_b"],
      take: 6,
    });
    expect(courseChatFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          course: {
            organizationId: "org1",
            enrollments: { some: { userId: { in: ["stu_a", "stu_b"] } } },
          },
        },
        take: 6,
      }),
    );
  });

  it("scopes STUDENT to own enrollments", async () => {
    await getRecentDiscussionMessages({
      userId: "stu1",
      organizationId: "org1",
      role: "STUDENT",
    });
    expect(courseChatFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          course: {
            organizationId: "org1",
            enrollments: { some: { userId: "stu1" } },
          },
        },
      }),
    );
  });

  it("scopes TEACHER to courses they authored", async () => {
    await getRecentDiscussionMessages({
      userId: "t1",
      organizationId: "org1",
      role: "TEACHER",
    });
    expect(courseChatFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          course: {
            organizationId: "org1",
            createdById: "t1",
          },
        },
      }),
    );
  });

  it("allows ADMIN org-wide course filter (organizationId only)", async () => {
    await getRecentDiscussionMessages({
      userId: "admin1",
      organizationId: "org1",
      role: "ADMIN",
    });
    expect(courseChatFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          course: {
            organizationId: "org1",
          },
        },
      }),
    );
  });
});
