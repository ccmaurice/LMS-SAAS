import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUnique, transaction } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/platform/platform-inbox", () => ({
  notifyPlatformNewSchoolPending: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findUnique },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
}));

import { selfServeRegisterSchool } from "@/lib/auth/self-serve-registration";

describe("selfServeRegisterSchool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid generated slug", async () => {
    const res = await selfServeRegisterSchool({
      email: "a@b.com",
      password: "password12",
      organizationName: "!!",
      organizationSlug: "a",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.error).toMatch(/slug/i);
    }
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns 409 when slug is already taken", async () => {
    findUnique.mockResolvedValueOnce({ id: "existing-org", slug: "acme-high" });
    const res = await selfServeRegisterSchool({
      email: "admin@acme.edu",
      password: "password12",
      organizationName: "Acme High",
      organizationSlug: "acme-high",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(409);
      expect(res.error).toMatch(/already taken/);
    }
    expect(transaction).not.toHaveBeenCalled();
  });

  it("creates org and binds admin user to organizationId (tenant isolation)", async () => {
    findUnique.mockResolvedValueOnce(null);

    const createdOrg = { id: "org_new_1", name: "North School", slug: "north-school", status: "PENDING" as const };
    const orgCreate = vi.fn().mockResolvedValue(createdOrg);
    const userCreate = vi.fn().mockResolvedValue({ id: "user_1" });
    const notificationCreate = vi.fn().mockResolvedValue({});

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        organization: { create: orgCreate },
        user: { create: userCreate },
        notification: { create: notificationCreate },
      });
    });

    const res = await selfServeRegisterSchool({
      email: "Admin@North.edu",
      password: "password12",
      name: " Pat ",
      organizationName: "North School",
      organizationSlug: "north-school",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.organization).toEqual({
        id: createdOrg.id,
        name: createdOrg.name,
        slug: createdOrg.slug,
      });
    }

    expect(orgCreate).toHaveBeenCalledWith({
      data: { name: "North School", slug: "north-school", status: "PENDING" },
    });
    expect(userCreate).toHaveBeenCalledWith({
      data: {
        email: "admin@north.edu",
        passwordHash: "hashed-password",
        name: "Pat",
        role: "ADMIN",
        organizationId: createdOrg.id,
      },
    });
    expect(notificationCreate).toHaveBeenCalled();
  });
});
