import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { isStaffRole } from "@/lib/courses/access";
import { slugifyPostTitle } from "@/lib/slug";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(2).max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  excerpt: z.string().max(500).optional().nullable(),
  body: z.string().min(1).max(200_000),
  published: z.boolean().optional(),
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const where = {
    organizationId: user.organizationId,
    ...(isStaffRole(user.role) ? {} : { published: true }),
  };

  const posts = await prisma.blogPost.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      published: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ posts });
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

  let slug = parsed.data.slug ?? slugifyPostTitle(parsed.data.title);
  const base = slug;
  let n = 0;
  while (
    await prisma.blogPost.findUnique({
      where: { organizationId_slug: { organizationId: user.organizationId, slug } },
    })
  ) {
    n += 1;
    slug = `${base}-${n}`;
  }

  const post = await prisma.blogPost.create({
    data: {
      organizationId: user.organizationId,
      authorId: user.id,
      title: parsed.data.title.trim(),
      slug,
      excerpt: parsed.data.excerpt?.trim() || null,
      body: parsed.data.body,
      published: parsed.data.published ?? false,
    },
    select: { id: true, slug: true, title: true, published: true },
  });

  return NextResponse.json({ post });
}
