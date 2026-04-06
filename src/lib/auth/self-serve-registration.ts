import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { isValidOrgSlug, normalizeOrgSlug } from "@/lib/slug";
import { notifyPlatformNewSchoolPending } from "@/lib/platform/platform-inbox";

export const selfServeRegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().max(120).optional(),
  organizationName: z.string().min(2).max(120),
  organizationSlug: z.string().optional(),
});

export type SelfServeRegisterBody = z.infer<typeof selfServeRegisterBodySchema>;

export type SelfServeRegisterResult =
  | {
      ok: true;
      organization: { id: string; name: string; slug: string };
    }
  | {
      ok: false;
      status: 400 | 409;
      error: string;
    };

const SLUG_RULE_MSG = "Organization URL slug must be 2–48 lowercase letters, numbers, or hyphens.";

/**
 * Creates a new {@link Organization} (status PENDING) and first ADMIN {@link User} bound to that org.
 * Tenant isolation: the admin user's `organizationId` is always the created org's id.
 */
export async function selfServeRegisterSchool(body: SelfServeRegisterBody): Promise<SelfServeRegisterResult> {
  const slug = normalizeOrgSlug(body.organizationSlug || body.organizationName);
  if (!isValidOrgSlug(slug)) {
    return { ok: false, status: 400, error: SLUG_RULE_MSG };
  }

  const existingOrg = await prisma.organization.findUnique({ where: { slug } });
  if (existingOrg) {
    return { ok: false, status: 409, error: "That organization URL is already taken." };
  }

  const passwordHash = await hashPassword(body.password);

  const { org } = await prisma.$transaction(async (tx) => {
    const orgRow = await tx.organization.create({
      data: {
        name: body.organizationName.trim(),
        slug,
        status: "PENDING",
      },
    });
    const userRow = await tx.user.create({
      data: {
        email: body.email.toLowerCase().trim(),
        passwordHash,
        name: body.name?.trim() || null,
        role: "ADMIN",
        organizationId: orgRow.id,
      },
    });
    await tx.notification.create({
      data: {
        userId: userRow.id,
        title: "Registration submitted",
        body: "Your school is pending platform approval. You will get another notice here when it is approved and you can sign in.",
      },
    });
    return { org: orgRow, user: userRow };
  });

  await notifyPlatformNewSchoolPending({
    organizationId: org.id,
    name: org.name,
    slug: org.slug,
  });

  return {
    ok: true,
    organization: { id: org.id, name: org.name, slug: org.slug },
  };
}
