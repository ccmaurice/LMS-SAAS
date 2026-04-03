import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";
import { buildProctoringWhere, parseIntegrityListFilters } from "@/lib/assessments/integrity-query";

const MAX_EXPORT = 15_000;

function escapeTsvField(s: string): string {
  return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

export async function GET(req: Request, ctx: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaffRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canTeacherManageCourse(user, assessment.course.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const listFilters = parseIntegrityListFilters(Object.fromEntries(url.searchParams.entries()));
  const where = buildProctoringWhere(assessmentId, {
    student: listFilters.student,
    eventType: listFilters.eventType,
    fromDate: listFilters.fromDate,
    toDate: listFilters.toDate,
  });

  const events = await prisma.proctoringEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT,
    include: { user: { select: { name: true, email: true } } },
  });

  const header = ["createdAt", "email", "name", "submissionId", "eventType", "payloadJson"];
  const lines = [
    header.join("\t"),
    ...events.map((e) =>
      [
        e.createdAt.toISOString(),
        e.user.email,
        e.user.name ?? "",
        e.submissionId ?? "",
        e.eventType,
        e.payload == null ? "" : JSON.stringify(e.payload),
      ]
        .map((c) => escapeTsvField(String(c)))
        .join("\t"),
    ),
  ];

  const body = lines.join("\n");
  const filename = `integrity-${assessmentId.slice(0, 10)}.tsv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
