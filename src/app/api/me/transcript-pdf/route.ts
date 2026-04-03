import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { academicCalendarCopy, parseOrganizationSettings } from "@/lib/education_context";
import { buildStudentTranscript } from "@/lib/transcript/build-transcript";
import {
  listAcademicTermsOrdered,
  transcriptScopeDescription,
  transcriptScopeFromSearchParams,
} from "@/lib/transcript/academic-term-scope";
import { loadOrganizationLogoBuffer } from "@/lib/org/org-logo";
import { buildTranscriptPdfBuffer } from "@/lib/reporting_engine";

/** PDF + logo fetch can exceed default serverless limits on Pro/Enterprise (capped on Hobby). */
export const maxDuration = 60;

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const url = new URL(req.url);
  const childParam = url.searchParams.get("child");
  const termParam = url.searchParams.get("term");
  const fromTermParam = url.searchParams.get("fromTerm");
  const toTermParam = url.searchParams.get("toTerm");

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
      educationLevel: true,
    },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let subjectId = user.id;
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
  }

  if ((user.role === "STUDENT" || user.role === "PARENT") && !org.reportCardsPublished) {
    return NextResponse.json({ error: "Report cards not published" }, { status: 403 });
  }

  if (user.role === "TEACHER" || user.role === "ADMIN") {
    return NextResponse.json({ error: "Transcript PDF is for students and parents" }, { status: 403 });
  }

  const subject = await prisma.user.findUnique({
    where: { id: subjectId },
    select: { name: true, email: true },
  });
  if (!subject) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [termScope, termsOrdered] = await Promise.all([
    transcriptScopeFromSearchParams(user.organizationId, {
      term: termParam ?? undefined,
      fromTerm: fromTermParam ?? undefined,
      toTerm: toTermParam ?? undefined,
    }),
    listAcademicTermsOrdered(user.organizationId),
  ]);
  const payload = await buildStudentTranscript(subjectId, user.organizationId, termScope);
  const cal = academicCalendarCopy(org.educationLevel);
  const scopeSubtitle = transcriptScopeDescription(termScope, termsOrdered, cal.scopePeriodLabels);
  const settings = parseOrganizationSettings(org.organizationSettings);

  const rows = payload.rows.map((r) => ({
    courseTitle: r.courseTitle,
    termLabel: r.termLabel,
    credits: r.credits,
    gradeLine:
      r.letterDisplay ?? (r.percent != null ? `${r.percent.toFixed(1)}%` : "—"),
    gpaPoints: r.gpaPoints != null ? r.gpaPoints.toFixed(2) : "—",
  }));

  const semesterSummaries =
    payload.educationLevel === "HIGHER_ED"
      ? payload.semesterSummaries.map((s) => ({
          semester: s.semester,
          termGpa: s.termGpa != null ? s.termGpa.toFixed(2) : "—",
          avgPercent: s.avgPercent != null ? `${s.avgPercent.toFixed(1)}%` : "—",
          credits: s.creditsCounted.toFixed(1),
        }))
      : undefined;

  const logoBuffer = await loadOrganizationLogoBuffer({
    organizationId: user.organizationId,
    slug: org.slug,
    logoImageUrl: org.logoImageUrl,
    heroImageUrl: org.heroImageUrl,
  });

  const pdf = await buildTranscriptPdfBuffer({
    orgName: org.name,
    academicYearLabel: org.academicYearLabel,
    studentLabel: subject.name?.trim() || subject.email,
    cumulativeGpa: payload.cumulativeGpa != null ? payload.cumulativeGpa.toFixed(2) : "—",
    creditsAttempted: payload.totalCreditsGraded.toFixed(1),
    showGpaColumn: payload.educationLevel === "HIGHER_ED",
    rows,
    semesterSummaries,
    scopeSubtitle,
    orgSettings: settings,
    logoBuffer,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="transcript.pdf"',
    },
  });
}
