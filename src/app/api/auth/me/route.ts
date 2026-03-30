import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { orgUserAvatarDisplayUrl } from "@/lib/profile/avatar-url";

const patchSchema = z.object({
  name: z.union([z.string().max(120), z.literal("")]).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
      imageUrl: orgUserAvatarDisplayUrl(user),
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
      },
    },
  });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const name =
    parsed.data.name === undefined ? undefined : parsed.data.name === "" ? null : parsed.data.name.trim() || null;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { ...(name !== undefined && { name }) },
    include: { organization: true },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      image: updated.image,
      imageUrl: orgUserAvatarDisplayUrl(updated),
      organization: {
        id: updated.organization.id,
        name: updated.organization.name,
        slug: updated.organization.slug,
      },
    },
  });
}
