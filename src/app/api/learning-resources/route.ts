import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { canManageLearningResource } from "@/lib/learning-resources/access";
import type { LearningResourceKind } from "@/generated/prisma/enums";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  kind: z.enum(["PDF", "VIDEO", "LINK", "OTHER"]),
  externalUrl: z.string().url().optional().nullable(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const where =
    user.role === "ADMIN"
      ? { organizationId: user.organizationId }
      : user.role === "TEACHER"
        ? {
            organizationId: user.organizationId,
            OR: [{ published: true }, { createdById: user.id }],
          }
        : { organizationId: user.organizationId, published: true };

  const rows = await prisma.learningResource.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      externalUrl: true,
      mimeType: true,
      sortOrder: true,
      published: true,
      storageKey: true,
      createdAt: true,
      createdById: true,
    },
  });

  const resources = rows.map(({ storageKey, createdById, ...r }) => ({
    ...r,
    hasFile: !!storageKey,
    canEdit: canManageLearningResource(user, { createdById }),
  }));

  return NextResponse.json({ resources });
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
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

  if (parsed.data.kind === "LINK" && !parsed.data.externalUrl?.trim()) {
    return NextResponse.json({ error: "LINK resources need externalUrl" }, { status: 400 });
  }

  const resource = await prisma.learningResource.create({
    data: {
      organizationId: user.organizationId,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      kind: parsed.data.kind as LearningResourceKind,
      externalUrl: parsed.data.externalUrl?.trim() || null,
      published: parsed.data.published ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
      createdById: user.id,
    },
    select: { id: true, title: true, kind: true },
  });

  return NextResponse.json({ resource });
}
