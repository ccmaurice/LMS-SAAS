import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { isValidOrgSlug, normalizeOrgSlug } from "@/lib/slug";
import { notifyPlatformNewSchoolPending } from "@/lib/platform/platform-inbox";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().max(120).optional(),
  organizationName: z.string().min(2).max(120),
  organizationSlug: z.string().optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email, password, name, organizationName, organizationSlug } = parsed.data;
  const slug = normalizeOrgSlug(organizationSlug || organizationName);
  if (!isValidOrgSlug(slug)) {
    return NextResponse.json(
      { error: "Organization URL slug must be 2–48 lowercase letters, numbers, or hyphens." },
      { status: 400 },
    );
  }

  const existingOrg = await prisma.organization.findUnique({ where: { slug } });
  if (existingOrg) {
    return NextResponse.json({ error: "That organization URL is already taken." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const { org, user } = await prisma.$transaction(async (tx) => {
    const orgRow = await tx.organization.create({
      data: {
        name: organizationName.trim(),
        slug,
        status: "PENDING",
      },
    });
    const userRow = await tx.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name?.trim() || null,
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

  return NextResponse.json({
    pendingApproval: true,
    organization: { id: org.id, name: org.name, slug: org.slug },
    message:
      "Your school is pending approval by a platform operator. You will be able to sign in after it is approved.",
  });
}
