import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  const visibility =
    user.role === "ADMIN"
      ? {}
      : user.role === "TEACHER"
        ? { OR: [{ published: true }, { createdById: user.id }] }
        : { published: true };

  const courses = await prisma.course.findMany({
    where: {
      organizationId: user.organizationId,
      ...(q ? { title: { contains: q } } : {}),
      ...visibility,
    },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
    take: 20,
  });

  return NextResponse.json({ courses });
}
