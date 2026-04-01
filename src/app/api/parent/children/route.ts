import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";

/** Linked students for the current parent (same org). */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  if (user.role !== "PARENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const links = await prisma.parentStudentLink.findMany({
    where: { parentUserId: user.id, organizationId: user.organizationId },
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    children: links.map((l) => ({
      linkId: l.id,
      userId: l.student.id,
      name: l.student.name,
      email: l.student.email,
    })),
  });
}
