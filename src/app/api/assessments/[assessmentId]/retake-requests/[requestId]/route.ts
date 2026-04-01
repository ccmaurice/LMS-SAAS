import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse } from "@/lib/courses/access";

const patchSchema = z.object({
  status: z.enum(["APPROVED", "DENIED"]),
  staffNote: z.string().max(5000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ assessmentId: string; requestId: string }> }) {
  const { assessmentId, requestId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canTeacherManageCourse(user, assessment.course.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const existing = await prisma.assessmentRetakeRequest.findFirst({
    where: { id: requestId, assessmentId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Request already resolved" }, { status: 400 });
  }

  const updated = await prisma.assessmentRetakeRequest.update({
    where: { id: requestId },
    data: {
      status: parsed.data.status,
      reviewedById: user.id,
      reviewedAt: new Date(),
      staffNote: parsed.data.staffNote?.trim() || null,
    },
  });

  return NextResponse.json({ request: updated });
}
