import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { getAssessmentInOrg } from "@/lib/assessments/access";

const deleteBodySchema = z.object({
  eventId: z.string().optional(),
  clearAll: z.boolean().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  
  // Enforce ADMIN role only for deleting/clearing logs!
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) {
    return NextResponse.json({ error: "Forbidden: Only admins can delete logs" }, { status: 403 });
  }

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { eventId, clearAll } = parsed.data;

  if (clearAll) {
    const result = await prisma.proctoringEvent.deleteMany({
      where: {
        assessmentId,
        organizationId: user.organizationId,
      },
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  }

  if (eventId) {
    try {
      await prisma.proctoringEvent.delete({
        where: {
          id: eventId,
          assessmentId,
          organizationId: user.organizationId,
        },
      });
      return NextResponse.json({ ok: true, deleted: 1 });
    } catch {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ error: "Provide either eventId or clearAll" }, { status: 400 });
}
