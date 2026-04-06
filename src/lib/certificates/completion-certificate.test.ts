import { describe, expect, it, vi, beforeEach } from "vitest";

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    courseCompletionCertificate: { findFirst },
  },
}));

import {
  completionCertificateVerifyPath,
  verifyCompletionCertificatePublic,
} from "@/lib/certificates/completion-certificate";

describe("verifyCompletionCertificatePublic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not ok for empty credential id", async () => {
    const res = await verifyCompletionCertificatePublic("demo-school", "   ");
    expect(res.ok).toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns not ok when credential id exceeds max length", async () => {
    const res = await verifyCompletionCertificatePublic("demo-school", "a".repeat(37));
    expect(res.ok).toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns not ok when no certificate matches slug and id", async () => {
    findFirst.mockResolvedValueOnce(null);
    const res = await verifyCompletionCertificatePublic("demo-school", "cmabc123validlengthhere00");
    expect(res.ok).toBe(false);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "cmabc123validlengthhere00",
        organization: { slug: "demo-school", status: "ACTIVE" },
      },
      include: {
        organization: { select: { name: true } },
        course: { select: { title: true, organizationId: true } },
        user: { select: { name: true, email: true } },
      },
    });
  });

  it("returns not ok when course organizationId does not match certificate organization (integrity)", async () => {
    findFirst.mockResolvedValueOnce({
      id: "cred1",
      organizationId: "org_a",
      issuedAt: new Date("2025-06-01"),
      organization: { name: "Good School" },
      course: { title: "Algebra", organizationId: "org_b" },
      user: { name: "Alex", email: "alex@x.com" },
    });
    const res = await verifyCompletionCertificatePublic("good-school", "cred1");
    expect(res.ok).toBe(false);
  });

  it("returns ok with school, course, recipient, and issued date when valid", async () => {
    const issuedAt = new Date("2025-06-15T12:00:00Z");
    findFirst.mockResolvedValueOnce({
      id: "cred1",
      organizationId: "org_same",
      issuedAt,
      organization: { name: "North High" },
      course: { title: "Biology 101", organizationId: "org_same" },
      user: { name: "  Jordan  ", email: "j@north.edu" },
    });
    const res = await verifyCompletionCertificatePublic("north-high", "cred1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.schoolName).toBe("North High");
      expect(res.courseTitle).toBe("Biology 101");
      expect(res.recipientDisplayName).toBe("Jordan");
      expect(res.issuedAt).toEqual(issuedAt);
    }
  });

  it("uses email when recipient name is empty", async () => {
    findFirst.mockResolvedValueOnce({
      id: "cred2",
      organizationId: "o1",
      issuedAt: new Date(),
      organization: { name: "S" },
      course: { title: "C", organizationId: "o1" },
      user: { name: null, email: "only@email.com" },
    });
    const res = await verifyCompletionCertificatePublic("s", "cred2");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.recipientDisplayName).toBe("only@email.com");
  });
});

describe("completionCertificateVerifyPath", () => {
  it("encodes slug and credential query param", () => {
    const path = completionCertificateVerifyPath("my-school", "cmid123");
    expect(path).toBe("/school/my-school/verify-certificate?id=cmid123");
  });

  it("percent-encodes special slug characters", () => {
    const path = completionCertificateVerifyPath("st mary", "x");
    expect(path).toContain(encodeURIComponent("st mary"));
    expect(path).toMatch(/^\/school\/st%20mary\/verify-certificate\?id=x$/);
  });
});
