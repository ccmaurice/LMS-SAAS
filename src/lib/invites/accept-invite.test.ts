import { describe, expect, it, vi, beforeEach } from "vitest";

const { inviteFindUnique, userFindUnique, transaction } = vi.hoisted(() => ({
  inviteFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    userInvite: { findUnique: inviteFindUnique },
    user: { findUnique: userFindUnique },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-invite-password"),
}));

import { acceptInviteSchoolUser } from "@/lib/invites/accept-invite";

function futureDate() {
  return new Date(Date.now() + 86400000);
}

function pastDate() {
  return new Date(Date.now() - 86400000);
}

describe("acceptInviteSchoolUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when invite token does not exist", async () => {
    inviteFindUnique.mockResolvedValueOnce(null);
    const res = await acceptInviteSchoolUser({
      token: "a".repeat(16),
      password: "password12",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.error).toMatch(/invalid or has expired/);
    }
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when invite is expired", async () => {
    inviteFindUnique.mockResolvedValueOnce({
      id: "inv1",
      token: "tok",
      email: "new@school.org",
      role: "STUDENT",
      organizationId: "org_x",
      expiresAt: pastDate(),
      organization: { id: "org_x", slug: "school", name: "School", status: "ACTIVE" },
    });
    const res = await acceptInviteSchoolUser({
      token: "tok",
      password: "password12",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns 403 when organization is not ACTIVE", async () => {
    inviteFindUnique.mockResolvedValueOnce({
      id: "inv1",
      token: "tok",
      email: "new@school.org",
      role: "TEACHER",
      organizationId: "org_x",
      expiresAt: futureDate(),
      organization: { id: "org_x", slug: "school", name: "School", status: "PENDING" },
    });
    const res = await acceptInviteSchoolUser({
      token: "tok",
      password: "password12",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.error).toMatch(/not active/);
    }
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("returns 409 when email already exists in that organization", async () => {
    inviteFindUnique.mockResolvedValueOnce({
      id: "inv1",
      token: "tok",
      email: "Existing@School.org",
      role: "STUDENT",
      organizationId: "org_x",
      expiresAt: futureDate(),
      organization: { id: "org_x", slug: "school", name: "School", status: "ACTIVE" },
    });
    userFindUnique.mockResolvedValueOnce({ id: "existing_user" });

    const res = await acceptInviteSchoolUser({
      token: "tok",
      password: "password12",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { organizationId_email: { organizationId: "org_x", email: "existing@school.org" } },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("creates user with organizationId and role from invite only (tenant binding)", async () => {
    const inviteRow = {
      id: "inv1",
      token: "toktoktoktoktok1",
      email: "Teacher@School.org",
      role: "TEACHER" as const,
      organizationId: "org_secure",
      expiresAt: futureDate(),
      organization: {
        id: "org_secure",
        slug: "secure-school",
        name: "Secure School",
        status: "ACTIVE" as const,
      },
    };
    inviteFindUnique.mockResolvedValueOnce(inviteRow);
    userFindUnique.mockResolvedValueOnce(null);

    const inviteDelete = vi.fn().mockResolvedValue({});
    const userCreate = vi.fn().mockResolvedValue({
      id: "new_user_1",
      email: "teacher@school.org",
      name: "Pat Lee",
      role: "TEACHER",
      organizationId: "org_secure",
      organization: {
        id: "org_secure",
        slug: "secure-school",
        name: "Secure School",
      },
    });

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        userInvite: { delete: inviteDelete },
        user: { create: userCreate },
      });
    });

    const res = await acceptInviteSchoolUser({
      token: "toktoktoktoktok1",
      password: "password12",
      name: " Pat Lee ",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.user.organizationId).toBe("org_secure");
      expect(res.user.role).toBe("TEACHER");
      expect(res.user.email).toBe("teacher@school.org");
    }

    expect(inviteDelete).toHaveBeenCalledWith({ where: { id: "inv1" } });
    expect(userCreate).toHaveBeenCalledWith({
      data: {
        email: "teacher@school.org",
        passwordHash: "hashed-invite-password",
        name: "Pat Lee",
        role: "TEACHER",
        organizationId: "org_secure",
      },
      include: { organization: true },
    });
  });
});
