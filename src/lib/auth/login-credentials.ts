import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { isValidOrgSlug, normalizeOrgSlug } from "@/lib/slug";
import type { Role } from "@/generated/prisma/enums";

export const loginCredentialsBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().min(1),
});

export type LoginCredentialsBody = z.infer<typeof loginCredentialsBodySchema>;

export function zodIssuesToLoginMessage(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`).join(" ");
}

export type CredentialLoginSuccess = {
  ok: true;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    organizationId: string;
    organization: { id: string; name: string; slug: string };
  };
};

export type CredentialLoginFailure = {
  ok: false;
  status: 400 | 401 | 403;
  error: string;
};

export type CredentialLoginResult = CredentialLoginSuccess | CredentialLoginFailure;

const NO_SCHOOL_MSG =
  "No school found for that slug. Run `npm run db:seed` (or `db:bootstrap`) for demo-school, or use the slug from your invite.";
const NO_PASSWORD_USER_MSG =
  "No password sign-in for that email in this school. Check the email, use the slug for the school that invited you, or run `npm run db:seed` for admin@test.com.";

/**
 * Validates org slug, resolves {@link Organization}, verifies email/password for a user in that org only.
 * Tenant isolation: user lookup uses composite `organizationId` + `email` — never email alone.
 */
export async function credentialLogin(body: LoginCredentialsBody): Promise<CredentialLoginResult> {
  const slug = normalizeOrgSlug(body.organizationSlug);
  if (!isValidOrgSlug(slug)) {
    return { ok: false, status: 400, error: "Invalid organization URL." };
  }

  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    return { ok: false, status: 401, error: NO_SCHOOL_MSG };
  }

  if (org.status === "PENDING") {
    return {
      ok: false,
      status: 403,
      error: "This school is still awaiting platform approval. You cannot sign in yet.",
    };
  }
  if (org.status === "REJECTED") {
    return {
      ok: false,
      status: 403,
      error:
        "This school registration was not approved. Contact the platform operator if you believe this is a mistake.",
    };
  }

  const email = body.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email,
      },
    },
    include: { organization: true },
  });

  if (!user?.passwordHash) {
    return { ok: false, status: 401, error: NO_PASSWORD_USER_MSG };
  }

  const passwordOk = await verifyPassword(body.password, user.passwordHash);
  if (!passwordOk) {
    return { ok: false, status: 401, error: "Wrong password for that email." };
  }

  if (user.suspendedAt) {
    return {
      ok: false,
      status: 403,
      error: "This account has been suspended. Contact your school administrator.",
    };
  }

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
        name: user.organization.name,
        slug: user.organization.slug,
      },
    },
  };
}
