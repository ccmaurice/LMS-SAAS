import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";

const FRAMEWORKS = ["IB", "CAMBRIDGE", "AP"] as const;

/** List shared + org-scoped question bank items (staff). */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const fw = url.searchParams.get("framework");
  const subjectQ = url.searchParams.get("subject")?.trim();

  const where: Prisma.QuestionBankItemWhereInput = {
    OR: [{ organizationId: null }, { organizationId: user.organizationId }],
  };

  if (fw && (FRAMEWORKS as readonly string[]).includes(fw)) {
    where.framework = fw as (typeof FRAMEWORKS)[number];
  }
  if (subjectQ) {
    where.subject = { contains: subjectQ, mode: "insensitive" };
  }

  const items = await prisma.questionBankItem.findMany({
    where,
    orderBy: [{ framework: "asc" }, { subject: "asc" }, { gradeLabel: "asc" }, { id: "asc" }],
    select: {
      id: true,
      framework: true,
      subject: true,
      gradeLabel: true,
      standardCode: true,
      type: true,
      prompt: true,
      points: true,
      options: true,
      correctAnswer: true,
      markingScheme: true,
      questionSchema: true,
      organizationId: true,
    },
  });

  return NextResponse.json({ items });
}
