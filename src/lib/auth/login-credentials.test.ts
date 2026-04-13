import { describe, expect, it, vi, beforeEach } from "vitest";

const { orgFindUnique, userFindUnique } = vi.hoisted(() => ({
  orgFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findUnique: orgFindUnique },
    user: { findUnique: userFindUnique },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(),
}));

import { verifyPassword } from "@/lib/auth/password";
import { credentialLogin } from "@/lib/auth/login-credentials";

describe("credentialLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid organization slug", async () => {
    const res = await credentialLogin({
      email: "a@b.com",
      password: "x",
      organizationSlug: "a",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.error).toMatch(/Invalid organization URL/);
    }
    expect(orgFindUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when no organization exists for slug", async () => {
    orgFindUnique.mockResolvedValueOnce(null);
    const res = await credentialLogin({
      email: "a@b.com",
      password: "secret",
      organizationSlug: "demo-school",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(401);
      expect(res.error).toMatch(/No school found/);
    }
  });

  it("returns 403 when organization is PENDING", async () => {
    orgFindUnique.mockResolvedValueOnce({
      id: "org1",
      slug: "pending-school",
      status: "PENDING",
    });
    const res = await credentialLogin({
      email: "a@b.com",
      password: "secret",
      organizationSlug: "pending-school",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.error).toMatch(/awaiting platform approval/);
    }
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("returns 403 when organization is REJECTED", async () => {
    orgFindUnique.mockResolvedValueOnce({
      id: "org1",
      slug: "bad-school",
      status: "REJECTED",
    });
    const res = await credentialLogin({
      email: "a@b.com",
      password: "secret",
      organizationSlug: "bad-school",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.error).toMatch(/not approved/);
    }
  });

  it("looks up user by organizationId and normalized email only", async () => {
    orgFindUnique.mockResolvedValueOnce({
      id: "org_abc",
      slug: "demo-school",
      status: "ACTIVE",
    });
    userFindUnique.mockResolvedValueOnce(null);

    const res = await credentialLogin({
      email: "  Admin@Test.COM ",
      password: "secret",
      organizationSlug: "demo-school",
    });

    expect(res.ok).toBe(false);
    expect(userFindUnique).toHaveBeenCalledWith({
      where: {
        organizationId_email: {
          organizationId: "org_abc",
          email: "admin@test.com",
        },
      },
      include: { organization: true },
    });
    if (!res.ok) {
      expect(res.status).toBe(401);
      expect(res.error).toMatch(/No account with that email/);
    }
  });

  it("returns 401 when user has no password hash", async () => {
    orgFindUnique.mockResolvedValueOnce({
      id: "org1",
      slug: "demo-school",
      status: "ACTIVE",
    });
    userFindUnique.mockResolvedValueOnce({
      id: "u1",
      email: "a@b.com",
      name: null,
      role: "STUDENT",
      organizationId: "org1",
      passwordHash: null,
      suspendedAt: null,
      organization: { id: "org1", name: "Demo", slug: "demo-school" },
    });

    const res = await credentialLogin({
      email: "a@b.com",
      password: "secret",
      organizationSlug: "demo-school",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(401);
      expect(res.error).toMatch(/no password on file/);
    }
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("returns 401 when password does not match", async () => {
    orgFindUnique.mockResolvedValueOnce({
      id: "org1",
      slug: "demo-school",
      status: "ACTIVE",
    });
    userFindUnique.mockResolvedValueOnce({
      id: "u1",
      email: "a@b.com",
      name: null,
      role: "STUDENT",
      organizationId: "org1",
      passwordHash: "hash",
      suspendedAt: null,
      organization: { id: "org1", name: "Demo", slug: "demo-school" },
    });
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    const res = await credentialLogin({
      email: "a@b.com",
      password: "wrong",
      organizationSlug: "demo-school",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(401);
      expect(res.error).toMatch(/Wrong password/);
    }
  });

  it("returns 403 when user is suspended", async () => {
    orgFindUnique.mockResolvedValueOnce({
      id: "org1",
      slug: "demo-school",
      status: "ACTIVE",
    });
    userFindUnique.mockResolvedValueOnce({
      id: "u1",
      email: "a@b.com",
      name: null,
      role: "STUDENT",
      organizationId: "org1",
      passwordHash: "hash",
      suspendedAt: new Date(),
      organization: { id: "org1", name: "Demo", slug: "demo-school" },
    });
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);

    const res = await credentialLogin({
      email: "a@b.com",
      password: "ok",
      organizationSlug: "demo-school",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.error).toMatch(/suspended/);
    }
  });

  it("returns user scoped to resolved organization on success", async () => {
    orgFindUnique.mockResolvedValueOnce({
      id: "org1",
      slug: "demo-school",
      status: "ACTIVE",
    });
    userFindUnique.mockResolvedValueOnce({
      id: "u1",
      email: "admin@test.com",
      name: "Admin",
      role: "ADMIN",
      organizationId: "org1",
      passwordHash: "hash",
      suspendedAt: null,
      organization: { id: "org1", name: "Demo School", slug: "demo-school" },
    });
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);

    const res = await credentialLogin({
      email: "admin@test.com",
      password: "password123",
      organizationSlug: "demo-school",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.user.organizationId).toBe("org1");
      expect(res.user.organization.slug).toBe("demo-school");
      expect(res.user.role).toBe("ADMIN");
    }
  });
});
