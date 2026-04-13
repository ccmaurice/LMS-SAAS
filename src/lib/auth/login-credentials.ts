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
const NO_ACCOUNT_MSG =
  "No account with that email in this school. Check the school slug and spelling of the email, or ask an administrator to invite you.";
const NO_PASSWORD_ON_FILE_MSG =
  "This account has no password on file (for example Google-only sign-in). Use Google to sign in, or ask an administrator to send an invite so you can set a password.";

/** Shown when demo-school + *@test.com — parent@test.com only exists after seeding that deployment's DB. */
function demoAccountsHint(email: string, orgSlug: string): string {
  if (orgSlug !== "demo-school" || !/@test\.com$/i.test(email)) return "";
  return " Demo users (parent@test.com, admin@test.com, … / password123) come from `npm run db:seed` on the same database this app uses — hosted sites are not auto-seeded; set DATABASE_URL to that Postgres URL first if you seed from your machine.";
}

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

  if (!user) {
    return { ok: false, status: 401, error: NO_ACCOUNT_MSG + demoAccountsHint(email, slug) };
  }

  if (!user.passwordHash) {
    return { ok: false, status: 401, error: NO_PASSWORD_ON_FILE_MSG };
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
