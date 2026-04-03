import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { buildStudentTranscript } from "@/lib/transcript/build-transcript";
import {
  buildTranscriptPdfQuery,
  listAcademicTermsOrdered,
  transcriptScopeDescription,
  transcriptScopeFromSearchParams,
  transcriptScopeQueryPairs,
} from "@/lib/transcript/academic-term-scope";
import { TranscriptSessionFilters } from "@/components/transcript/transcript-session-filters";
import { TranscriptView, type TranscriptRowClient } from "@/components/transcript/transcript-view";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { getOrganizationLogoUrl } from "@/lib/org/org-logo";
import { academicCalendarCopy } from "@/lib/education_context";

export default async function TranscriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ child?: string; term?: string; fromTerm?: string; toTerm?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      id: true,
      slug: true,
      name: true,
      academicYearLabel: true,
      reportCardsPublished: true,
      heroImageUrl: true,
      logoImageUrl: true,
      educationLevel: true,
    },
  });
  const cal = academicCalendarCopy(org?.educationLevel ?? user.organization.educationLevel);
  const orgLogoUrl =
    org != null ? await getOrganizationLogoUrl(org.id, org.slug, org.logoImageUrl, org.heroImageUrl) : null;

  const base = `/o/${slug}`;

  const parentLinks =
    user.role === "PARENT"
      ? await prisma.parentStudentLink.findMany({
          where: { parentUserId: user.id, organizationId: user.organizationId },
          select: { studentUserId: true },
        })
      : [];
  const parentChildIds = parentLinks.map((l) => l.studentUserId);

  let subjectUserId = user.id;
  if (user.role === "PARENT") {
    if (parentChildIds.length === 0) {
      return (
        <div className="mx-auto max-w-4xl space-y-6">
          <h1 className="page-title">Transcript</h1>
          <p className="text-sm text-muted-foreground">Link a student to your parent account to view their transcript.</p>
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            ← Dashboard
          </Link>
        </div>
      );
    }
    const want = typeof sp.child === "string" ? sp.child : parentChildIds[0];
    subjectUserId = parentChildIds.includes(want) ? want : parentChildIds[0];
  }

  if (
    (user.role === "STUDENT" || user.role === "PARENT") &&
    !org?.reportCardsPublished
  ) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="page-title">Transcript</h1>
        <p className="text-sm text-muted-foreground">
          Academic records are not published for students right now. Ask your administrator to enable report cards under
          School settings.
        </p>
        <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Dashboard
        </Link>
      </div>
    );
  }

  if (user.role === "TEACHER" || user.role === "ADMIN") {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="page-title">Transcript</h1>
        <p className="text-sm text-muted-foreground">
          Staff view: open a student’s profile from Users, or sign in as a student demo account to preview transcript and
          GPA. Students can filter by {cal.periodSingular} (course calendar) or a range across school years; grades still
          use assessment semesters 1–3 and promotion settings on each course.
        </p>
        <Link href={`${base}/admin/users`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Users admin
        </Link>
      </div>
    );
  }

  const [termScope, termsOrdered] = await Promise.all([
    transcriptScopeFromSearchParams(user.organizationId, {
      term: typeof sp.term === "string" ? sp.term : undefined,
      fromTerm: typeof sp.fromTerm === "string" ? sp.fromTerm : undefined,
      toTerm: typeof sp.toTerm === "string" ? sp.toTerm : undefined,
    }),
    listAcademicTermsOrdered(user.organizationId),
  ]);

  const payload = await buildStudentTranscript(subjectUserId, user.organizationId, termScope);
  const scopeSubtitle = transcriptScopeDescription(termScope, termsOrdered, cal.scopePeriodLabels);
  const pdfQuery = buildTranscriptPdfQuery({
    child: user.role === "PARENT" ? subjectUserId : undefined,
    scope: termScope,
  });

  const parentTranscriptExtraQs = transcriptScopeQueryPairs(termScope)
    .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("");

  const rowsClient: TranscriptRowClient[] = payload.rows.map((r) => ({
    courseId: r.courseId,
    courseTitle: r.courseTitle,
    credits: r.credits,
    termLabel: r.termLabel,
    percent: r.percent,
    letterDisplay: r.letterDisplay,
    gpaPoints: r.gpaPoints,
  }));

  const parentChildren =
    user.role === "PARENT" && parentChildIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: parentChildIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

  return (
    <div className="mx-auto max-w-4xl space-y-4 print:max-w-none">
      {user.role === "PARENT" && parentChildren.length > 1 ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-muted-foreground">Student:</span>
          {parentChildren.map((c) => (
            <Link
              key={c.id}
              href={`${base}/transcript?child=${encodeURIComponent(c.id)}${parentTranscriptExtraQs}`}
              className={cn(
                buttonVariants({
                  variant: c.id === subjectUserId ? "default" : "outline",
                  size: "sm",
                }),
              )}
            >
              {c.name?.trim() || c.email}
            </Link>
          ))}
        </div>
      ) : null}
      <TranscriptSessionFilters
        basePath={`${base}/transcript`}
        terms={termsOrdered.map((t) => ({ id: t.id, label: t.label }))}
        currentScope={termScope}
        childUserId={user.role === "PARENT" ? subjectUserId : undefined}
        calendar={cal}
      />
      <TranscriptView
        slug={slug}
        orgName={org?.name ?? "School"}
        orgLogoUrl={orgLogoUrl}
        academicYearLabel={org?.academicYearLabel ?? "—"}
        scopeSubtitle={scopeSubtitle}
        coursePeriodColumnLabel={cal.periodSingularCapitalized}
        emptyRowsHint={
          termScope.kind !== "all" && payload.rows.length === 0
            ? `No courses in this ${cal.periodSingular} scope. Assign ${cal.courseFieldLabel.toLowerCase()} on each course (edit course) and ensure you are enrolled.`
            : undefined
        }
        showGpa={payload.educationLevel === "HIGHER_ED"}
        cumulativeGpa={payload.cumulativeGpa}
        totalCreditsGraded={payload.totalCreditsGraded}
        rows={rowsClient}
        semesterSummaries={payload.semesterSummaries}
        pdfQuery={pdfQuery}
      />
    </div>
  );
}
