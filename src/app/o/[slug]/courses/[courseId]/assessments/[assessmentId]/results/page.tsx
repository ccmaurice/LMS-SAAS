import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherManageCourse, isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { AssessmentPrompt } from "@/components/assessments/assessment-prompt";
import { StudentRetakePanel } from "@/components/assessments/student-retake-panel";

function clampAttempts(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(50, Math.max(1, Math.floor(n)));
}

function formatAnswerForDisplay(type: string, content: string): string {
  if (type === "DRAG_DROP") {
    try {
      const j = JSON.parse(content) as { assignments?: Record<string, string> };
      if (j.assignments && typeof j.assignments === "object") {
        const lines = Object.entries(j.assignments).map(([tid, bid]) => `${tid} → ${bid}`);
        return lines.length ? lines.join("\n") : "(no placements)";
      }
    } catch {
      /* fall through */
    }
    return content || "(empty)";
  }
  if (type === "FORMULA") {
    try {
      const j = JSON.parse(content) as { latex?: string };
      if (typeof j.latex === "string") return j.latex;
    } catch {
      /* plain */
    }
  }
  if (type === "MCQ") {
    try {
      const j = JSON.parse(content) as { choiceId?: string };
      return j.choiceId ? `Selected: ${j.choiceId}` : "(no selection)";
    } catch {
      return content || "(empty)";
    }
  }
  if (type === "TRUE_FALSE") {
    try {
      const j = JSON.parse(content) as { value?: boolean };
      if (typeof j.value === "boolean") return j.value ? "True" : "False";
    } catch {
      /* ignore */
    }
  }
  return content || "(empty)";
}

export default async function AssessmentResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; courseId: string; assessmentId: string }>;
  searchParams: Promise<{ submissionId?: string }>;
}) {
  const { slug, courseId, assessmentId } = await params;
  const { submissionId } = await searchParams;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment || assessment.courseId !== courseId) notFound();

  if (!submissionId) {
    return (
      <p className="text-muted-foreground">
        No submission selected.{" "}
        <Link href={`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/take`} className="text-primary underline">
          Take assessment
        </Link>
      </p>
    );
  }

  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      assessmentId,
    },
    include: {
      answers: { include: { question: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!submission) notFound();

  const ownerId = submission.userId;
  const isOwner = ownerId === user.id;
  let canView = isOwner;

  if (!canView && user.role === "PARENT") {
    const link = await prisma.parentStudentLink.findFirst({
      where: {
        parentUserId: user.id,
        studentUserId: ownerId,
        organizationId: user.organizationId,
      },
    });
    canView = !!link;
  }

  const staffViewer = isStaffRole(user.role) && canTeacherManageCourse(user, assessment.course.createdById);

  if (!canView && staffViewer) {
    canView = true;
  }

  if (!canView) notFound();

  const base = `/o/${slug}/courses/${courseId}/assessments`;
  const viewerIsProxy = !isOwner;
  const studentLabel = submission.user.name?.trim() || submission.user.email;

  const showGradingKeys =
    submission.status !== "DRAFT" &&
    (staffViewer || (isOwner && assessment.showAnswersToStudents));

  const maxAttempts = clampAttempts(assessment.maxAttemptsPerStudent);
  const completedAttempts = await prisma.submission.count({
    where: {
      assessmentId,
      userId: ownerId,
      status: { in: ["SUBMITTED", "GRADED"] },
    },
  });

  const pendingRetake = await prisma.assessmentRetakeRequest.findFirst({
    where: { assessmentId, userId: ownerId, status: "PENDING" },
    select: { id: true },
  });

  const lastDenied = await prisma.assessmentRetakeRequest.findFirst({
    where: { assessmentId, userId: ownerId, status: "DENIED" },
    orderBy: { reviewedAt: "desc" },
    select: { staffNote: true },
  });

  const showRetakeUi =
    isOwner && user.role === "STUDENT" && submission.status !== "DRAFT" && assessment.retakeRequiresApproval;

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        ← Assessments
      </Link>
      <div>
        <h1 className="page-title">Results · {assessment.title}</h1>
        {viewerIsProxy ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Viewing submission for <span className="font-medium text-foreground">{studentLabel}</span>
          </p>
        ) : null}
        <p className="mt-3 rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm dark:border-white/10">
          <span className="text-muted-foreground">Status </span>
          <span className="font-medium">{submission.status}</span>
          <span className="mx-2 text-muted-foreground">·</span>
          <span className="text-muted-foreground">Score </span>
          <span className="font-semibold tabular-nums">
            {submission.totalScore ?? "—"} / {submission.maxScore ?? "—"}
          </span>
        </p>
      </div>

      {isOwner && user.role === "STUDENT" && submission.status !== "DRAFT" && completedAttempts < maxAttempts ? (
        <Link
          href={`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/take`}
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "inline-flex")}
        >
          Take again ({completedAttempts}/{maxAttempts} submitted)
        </Link>
      ) : null}

      {isOwner && user.role === "STUDENT" && submission.status !== "DRAFT" && completedAttempts >= maxAttempts && !assessment.retakeRequiresApproval ? (
        <p className="text-sm text-muted-foreground">You have used all {maxAttempts} allowed attempt{maxAttempts === 1 ? "" : "s"}.</p>
      ) : null}

      {showRetakeUi ? (
        <StudentRetakePanel
          assessmentId={assessment.id}
          submissionId={submission.id}
          retakeRequiresApproval={assessment.retakeRequiresApproval}
          completedAttempts={completedAttempts}
          maxAttemptsPerStudent={maxAttempts}
          initialPending={!!pendingRetake}
          initialLastDeniedNote={lastDenied?.staffNote?.trim() || null}
        />
      ) : null}

      {!assessment.showAnswersToStudents && isOwner && user.role === "STUDENT" && submission.status !== "DRAFT" ? (
        <p className="text-sm text-muted-foreground">
          Your instructor has turned off answer review for this activity. You can still see your score and any written
          feedback above each question when provided.
        </p>
      ) : null}

      <ul className="space-y-6">
        {submission.answers.map((a) => (
          <li key={a.id} className="surface-bento border-border/60 p-5 dark:border-white/10">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {a.question.type} · Score: {a.manualScore != null ? a.manualScore : (a.score ?? "—")} / {a.question.points}
            </p>
            <AssessmentPrompt text={a.question.prompt} className="mt-2 text-sm font-medium leading-relaxed" />
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/30 px-3 py-2 text-sm text-foreground/90">
              <span className="text-muted-foreground">{viewerIsProxy ? "Student answer" : "Your answer"}: </span>
              {formatAnswerForDisplay(a.question.type, a.content)}
            </p>
            {showGradingKeys ? (
              <div className="mt-4 border-t border-border/80 pt-4 text-xs text-muted-foreground dark:border-white/10">
                {a.question.type === "MCQ" && a.question.options ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/20 p-2">
                    Key: {JSON.stringify(a.question.options, null, 2)}
                  </pre>
                ) : null}
                {a.question.correctAnswer ? (
                  <p className="mt-2">
                    Expected: <span className="text-foreground">{a.question.correctAnswer}</span>
                  </p>
                ) : null}
                {a.question.type === "DRAG_DROP" && a.question.questionSchema ? (
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/20 p-2">
                    Schema: {JSON.stringify(a.question.questionSchema, null, 2)}
                  </pre>
                ) : null}
                {a.aiFeedback ? (
                  <p className="mt-2 whitespace-pre-wrap text-foreground">AI feedback: {a.aiFeedback}</p>
                ) : null}
                {a.manualComment ? <p className="mt-2 text-foreground">Instructor: {a.manualComment}</p> : null}
              </div>
            ) : submission.status !== "DRAFT" && viewerIsProxy ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Answer keys and model solutions are hidden in guardian view. See overall scores above or ask the school
                for a formal report.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
