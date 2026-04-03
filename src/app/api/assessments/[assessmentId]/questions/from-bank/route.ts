import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse } from "@/lib/courses/access";
import {
  canReadQuestionBankItem,
  questionCreateDataFromBankItem,
} from "@/lib/assessments/question-bank";

const bodySchema = z.object({
  bankItemId: z.string().min(1).max(128),
});

/** Append a question cloned from the question bank to this assessment. */
export async function POST(req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canTeacherManageCourse(user, assessment.course.createdById)) {
    return NextResponse.json({ error: "Only the course author or an admin can edit questions" }, { status: 403 });
  }

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

  const item = await prisma.questionBankItem.findUnique({
    where: { id: parsed.data.bankItemId },
  });
  if (!item || !canReadQuestionBankItem(item, user.organizationId)) {
    return NextResponse.json({ error: "Bank item not found" }, { status: 404 });
  }

  const { data, error } = questionCreateDataFromBankItem(item);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const maxOrder = await prisma.question.aggregate({
    where: { assessmentId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const question = await prisma.question.create({
    data: {
      assessmentId,
      order,
      ...data,
    },
  });

  return NextResponse.json({ question });
}
