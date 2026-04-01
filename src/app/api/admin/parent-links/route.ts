import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const bodySchema = z.object({
  parentUserId: z.string().min(1),
  studentUserId: z.string().min(1),
});

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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const [parent, student] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: parsed.data.parentUserId,
        organizationId: user.organizationId,
        role: "PARENT",
      },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: {
        id: parsed.data.studentUserId,
        organizationId: user.organizationId,
        role: "STUDENT",
      },
      select: { id: true },
    }),
  ]);

  if (!parent || !student) {
    return NextResponse.json({ error: "Parent and student must exist in this organization with correct roles" }, { status: 400 });
  }

  const link = await prisma.parentStudentLink.upsert({
    where: {
      organizationId_parentUserId_studentUserId: {
        organizationId: user.organizationId,
        parentUserId: parent.id,
        studentUserId: student.id,
      },
    },
    create: {
      organizationId: user.organizationId,
      parentUserId: parent.id,
      studentUserId: student.id,
    },
    update: {},
    select: { id: true },
  });

  return NextResponse.json({ link });
}
