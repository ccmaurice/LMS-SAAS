import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@/generated/prisma/enums";

export const acceptInviteBodySchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(8).max(128),
  name: z.string().max(120).optional(),
});

export type AcceptInviteBody = z.infer<typeof acceptInviteBodySchema>;

export type AcceptInviteSuccess = {
  ok: true;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    organizationId: string;
    organization: { id: string; slug: string; name: string };
  };
};

export type AcceptInviteFailure = {
  ok: false;
  status: 400 | 403 | 409;
  error: string;
};

export type AcceptInviteResult = AcceptInviteSuccess | AcceptInviteFailure;

/**
 * Consumes a {@link UserInvite} and creates a {@link User} in the **invite's organization only**.
 * Tenant isolation: `organizationId` and `role` are taken exclusively from the invite row, not from the client.
 */
export async function acceptInviteSchoolUser(body: AcceptInviteBody): Promise<AcceptInviteResult> {
  const invite = await prisma.userInvite.findUnique({
    where: { token: body.token },
    include: { organization: true },
  });

  if (!invite || invite.expiresAt <= new Date()) {
    return { ok: false, status: 400, error: "This invite is invalid or has expired." };
  }

  if (invite.organization.status !== "ACTIVE") {
    return {
      ok: false,
      status: 403,
      error: "This school is not active yet (pending approval or inactive). Invites cannot be accepted.",
    };
  }

  const email = invite.email.toLowerCase().trim();
  const taken = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: invite.organizationId, email } },
  });
  if (taken) {
    return {
      ok: false,
      status: 409,
      error: "This email is already registered in this organization.",
    };
  }

  const passwordHash = await hashPassword(body.password);

  const user = await prisma.$transaction(async (tx) => {
    await tx.userInvite.delete({ where: { id: invite.id } });
    return tx.user.create({
      data: {
        email,
        passwordHash,
        name: body.name?.trim() || null,
        role: invite.role,
        organizationId: invite.organizationId,
      },
      include: { organization: true },
    });
  });

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organization: {
        id: user.organization.id,
        slug: user.organization.slug,
        name: user.organization.name,
      },
    },
  };
}
