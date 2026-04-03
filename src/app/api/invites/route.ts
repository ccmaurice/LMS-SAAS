import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { sendTransactionalEmail } from "@/lib/email/send";
import { generateInviteToken } from "@/lib/invites/token";
import { getAppOrigin } from "@/lib/seo/metadata-base";

const createSchema = z.object({
  email: z.string().email(),
  role: z.enum(["TEACHER", "STUDENT", "PARENT"]),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const invites = await prisma.userInvite.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ invites });
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const days = parsed.data.expiresInDays ?? 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const existingUser = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: user.organizationId, email } },
  });
  if (existingUser) {
    return NextResponse.json({ error: "A user with this email already belongs to your organization." }, { status: 409 });
  }

  const pending = await prisma.userInvite.findFirst({
    where: {
      organizationId: user.organizationId,
      email,
      expiresAt: { gt: new Date() },
    },
  });
  if (pending) {
    return NextResponse.json({ error: "An active invite for this email already exists." }, { status: 409 });
  }

  const token = generateInviteToken();
  const invite = await prisma.userInvite.create({
    data: {
      organizationId: user.organizationId,
      email,
      role: parsed.data.role,
      token,
      expiresAt,
      createdById: user.id,
    },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  const inviteUrl = `${getAppOrigin()}/invite/${token}`;
  const orgName = user.organization.name;
  void sendTransactionalEmail({
    to: email,
    subject: `You're invited to ${orgName}`,
    text: `You've been invited to join ${orgName} as a ${parsed.data.role.toLowerCase()}.\n\nAccept your invite (expires in ${days} day(s)):\n${inviteUrl}`,
  });

  return NextResponse.json({ invite });
}
