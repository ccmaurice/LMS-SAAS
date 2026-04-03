import { NextResponse } from "next/server";
import type { GradingScaleType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { parseOrganizationSettings } from "@/lib/education_context";
import { getUserReportCardRows } from "@/lib/dashboard/insights";
import { loadOrganizationLogoBuffer } from "@/lib/org/org-logo";
import { buildReportCardPdfBuffer } from "@/lib/reporting_engine";

/** PDF generation can exceed default limits on Pro/Enterprise (capped on Hobby). */
export const maxDuration = 60;

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const url = new URL(req.url);
  const childParam = url.searchParams.get("child");

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      slug: true,
      name: true,
      academicYearLabel: true,
      reportCardsPublished: true,
      organizationSettings: true,
      heroImageUrl: true,
      logoImageUrl: true,
    },
  });
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let subjectId = user.id;
  let roleForRows = user.role;

  if (user.role === "PARENT") {
    const links = await prisma.parentStudentLink.findMany({
      where: { parentUserId: user.id, organizationId: user.organizationId },
      select: { studentUserId: true },
    });
    const allowed = links.map((l) => l.studentUserId);
    if (allowed.length === 0) {
      return NextResponse.json({ error: "No linked students" }, { status: 400 });
    }
    const pick = childParam && allowed.includes(childParam) ? childParam : allowed[0];
    subjectId = pick;
    roleForRows = "STUDENT";
  }

  if ((user.role === "STUDENT" || user.role === "PARENT") && !org.reportCardsPublished) {
    return NextResponse.json({ error: "Report cards not published" }, { status: 403 });
  }

  const subject = await prisma.user.findUnique({
    where: { id: subjectId },
    select: { name: true, email: true },
  });
  if (!subject) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const rows = await getUserReportCardRows(subjectId, user.organizationId, roleForRows);
  const settings = parseOrganizationSettings(org.organizationSettings);

  const logoBuffer = await loadOrganizationLogoBuffer({
    organizationId: user.organizationId,
    slug: org.slug,
    logoImageUrl: org.logoImageUrl,
    heroImageUrl: org.heroImageUrl,
  });

  const pdf = await buildReportCardPdfBuffer({
    orgName: org.name,
    academicYearLabel: org.academicYearLabel,
    studentLabel: subject.name?.trim() || subject.email,
    orgSettings: settings,
    showRank: settings.reportShowRank === true,
    logoBuffer,
    rows: rows.map((r) => ({
      courseTitle: r.courseTitle,
      assessmentTitle: r.assessmentTitle,
      total: r.totalScore,
      max: r.maxScore,
      gradingScale: r.gradingScale as GradingScaleType,
    })),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="report-card.pdf"',
    },
  });
}
