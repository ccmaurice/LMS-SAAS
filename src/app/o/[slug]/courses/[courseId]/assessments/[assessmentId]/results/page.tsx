import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssessmentInOrg } from "@/lib/assessments/access";
import { canTeacherActOnAssessmentCourse } from "@/lib/assessments/staff-access";
import { isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { AssessmentPrompt } from "@/components/assessments/assessment-prompt";
import { StudentRetakePanel } from "@/components/assessments/student-retake-panel";
import { getServerT } from "@/i18n/server";
import { Check, X, AlertTriangle } from "lucide-react";
import { parseMcqOptions } from "@/lib/assessments/mcq";
import { parseDragDropFromQuestionSchema } from "@/lib/assessments/drag-drop-schema";

function clampAttempts(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(50, Math.max(1, Math.floor(n)));
}

function formatAnswerForDisplay(type: string, content: string, tr: (key: string) => string): string {
  const empty = () => tr("assessments.results.emptyDisplay");
  if (type === "DRAG_DROP") {
    try {
      const j = JSON.parse(content) as { assignments?: Record<string, string> };
      if (j.assignments && typeof j.assignments === "object") {
        const lines = Object.entries(j.assignments).map(([tid, bid]) => `${tid} → ${bid}`);
        return lines.length ? lines.join("\n") : tr("assessments.results.noPlacements");
      }
    } catch {
      /* fall through */
    }
    return content || empty();
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
      return j.choiceId
        ? tr("assessments.results.selectedChoice").replace("%s", j.choiceId)
        : tr("assessments.results.noSelection");
    } catch {
      return content || empty();
    }
  }
  if (type === "TRUE_FALSE") {
    try {
      const j = JSON.parse(content) as { value?: boolean };
      if (typeof j.value === "boolean")
        return j.value ? tr("assessments.results.boolTrue") : tr("assessments.results.boolFalse");
    } catch {
      /* ignore */
    }
  }
  return content || empty();
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
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const assessment = await getAssessmentInOrg(assessmentId, user.organizationId);
  if (!assessment || assessment.courseId !== courseId) notFound();

  if (!submissionId) {
    return (
      <p className="text-muted-foreground">
        {t("assessments.results.noSubmission")}{" "}
        <Link href={`/o/${slug}/courses/${courseId}/assessments/${assessmentId}/take`} className="text-primary underline">
          {t("assessments.results.takeAssessmentLink")}
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

  const staffViewer =
    isStaffRole(user.role) && (await canTeacherActOnAssessmentCourse(user, courseId));

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
        {t("assessments.results.back")}
      </Link>
      <div>
        <h1 className="page-title">{t("assessments.results.title").replace("%s", assessment.title)}</h1>
        {viewerIsProxy ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("assessments.results.viewingForLead")}{" "}
            <span className="font-medium text-foreground">{studentLabel}</span>
          </p>
        ) : null}
        <p className="mt-3 rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm dark:border-white/10">
          <span className="text-muted-foreground">{t("assessments.results.statusWord")} </span>
          <span className="font-medium">{submission.status}</span>
          <span className="mx-2 text-muted-foreground">·</span>
          <span className="text-muted-foreground">{t("assessments.results.scoreWord")} </span>
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
          {t("assessments.results.takeAgain")
            .replace("%s", String(completedAttempts))
            .replace("%s", String(maxAttempts))}
        </Link>
      ) : null}

      {isOwner && user.role === "STUDENT" && submission.status !== "DRAFT" && completedAttempts >= maxAttempts && !assessment.retakeRequiresApproval ? (
        <p className="text-sm text-muted-foreground">
          {t("assessments.results.allAttemptsUsed")
            .replace("%s", String(maxAttempts))
            .replace("%s", maxAttempts === 1 ? "" : "s")}
        </p>
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
        <p className="text-sm text-muted-foreground">{t("assessments.results.answerReviewOff")}</p>
      ) : null}

      <ul className="space-y-6">
        {submission.answers.map((a) => {
          let studentSelectedChoiceId: string | undefined;
          let studentSelectedBool: boolean | undefined;
          let studentDragDropAssignments: Record<string, string> = {};

          try {
            const j = JSON.parse(a.content || "{}");
            if (a.question.type === "MCQ") {
              studentSelectedChoiceId = j.choiceId ?? j.id;
            } else if (a.question.type === "TRUE_FALSE") {
              studentSelectedBool = j.value;
            } else if (a.question.type === "DRAG_DROP") {
              studentDragDropAssignments = j.assignments || {};
            }
          } catch {
            /* ignore */
          }

          const mcqOpts = a.question.type === "MCQ" ? parseMcqOptions(a.question.options) : null;
          const ddSchema = a.question.type === "DRAG_DROP" ? parseDragDropFromQuestionSchema(a.question.questionSchema) : null;

          return (
            <li key={a.id} className="surface-bento border-border/60 p-5 dark:border-white/10 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("assessments.results.perAnswerMeta")
                  .replace("%s", a.question.type)
                  .replace("%s", String(a.manualScore != null ? a.manualScore : (a.score ?? "—")))
                  .replace("%s", String(a.question.points))}
              </p>
              <AssessmentPrompt text={a.question.prompt} className="mt-2.5 text-sm font-bold leading-relaxed text-foreground" />

              {/* 1. MCQ Options Render */}
              {a.question.type === "MCQ" && mcqOpts && (
                <div className="mt-4 space-y-2">
                  <div className="space-y-2">
                    {mcqOpts.choices.map((choice) => {
                      const isSelected = choice.id === studentSelectedChoiceId;
                      const isCorrect = choice.correct === true;
                      
                      let borderClass = "border-border/60 bg-muted/10";
                      let textClass = "text-foreground";
                      let badge = null;

                      if (showGradingKeys) {
                        if (isCorrect) {
                          borderClass = "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10";
                          textClass = "text-emerald-600 dark:text-emerald-400 font-semibold";
                          badge = (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                              <Check className="w-3 h-3" /> Correct Answer
                            </span>
                          );
                        }
                        if (isSelected && !isCorrect) {
                          borderClass = "border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10";
                          textClass = "text-rose-600 dark:text-rose-400 font-medium";
                          badge = (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                              <X className="w-3 h-3" /> Your Selection (Incorrect)
                            </span>
                          );
                        } else if (isSelected && isCorrect) {
                          badge = (
                            <div className="flex gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                <Check className="w-3 h-3" /> Your Selection
                              </span>
                            </div>
                          );
                        }
                      } else if (isSelected) {
                        borderClass = "border-primary/30 bg-primary/5";
                        badge = (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                            Your Selection
                          </span>
                        );
                      }

                      return (
                        <div
                          key={choice.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border text-sm transition-all",
                            borderClass
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0",
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/30 text-muted-foreground"
                              )}
                            >
                              {choice.id.toUpperCase()}
                            </div>
                            <span className={textClass}>{choice.text}</span>
                          </div>
                          {badge}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. TRUE_FALSE Options Render */}
              {a.question.type === "TRUE_FALSE" && (
                <div className="mt-4 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    {[true, false].map((val) => {
                      const label = val ? t("assessments.results.boolTrue") : t("assessments.results.boolFalse");
                      const isSelected = studentSelectedBool === val;
                      const expectedStr = a.question.correctAnswer?.trim().toLowerCase();
                      const isCorrect = expectedStr === String(val);

                      let borderClass = "border-border/60 bg-muted/10";
                      let textClass = "text-foreground";
                      let badge = null;

                      if (showGradingKeys) {
                        if (isCorrect) {
                          borderClass = "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10";
                          textClass = "text-emerald-600 dark:text-emerald-400 font-semibold";
                          badge = (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                              <Check className="w-3 h-3" /> Correct
                            </span>
                          );
                        }
                        if (isSelected && !isCorrect) {
                          borderClass = "border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10";
                          textClass = "text-rose-600 dark:text-rose-400 font-medium";
                          badge = (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                              <X className="w-3 h-3" /> Selected (Incorrect)
                            </span>
                          );
                        } else if (isSelected && isCorrect) {
                          badge = (
                            <div className="flex gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                Selected &amp; Correct
                              </span>
                            </div>
                          );
                        }
                      } else if (isSelected) {
                        borderClass = "border-primary/30 bg-primary/5";
                        badge = (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                            Selected
                          </span>
                        );
                      }

                      return (
                        <div
                          key={String(val)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border text-sm transition-all",
                            borderClass
                          )}
                        >
                          <span className={textClass}>{label}</span>
                          {badge}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. DRAG_DROP Matching Report */}
              {a.question.type === "DRAG_DROP" && ddSchema && (
                <div className="mt-4 space-y-2">
                  <div className="border border-border/85 rounded-lg overflow-hidden bg-muted/5 dark:bg-muted/10">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border/80">
                          <th className="p-3 font-semibold text-muted-foreground w-1/3">Target Slot</th>
                          <th className="p-3 font-semibold text-muted-foreground w-1/3">Student Placement</th>
                          {showGradingKeys && <th className="p-3 font-semibold text-muted-foreground w-1/3">Expected Matching</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {ddSchema.targets.map((target) => {
                          const studentItemId = studentDragDropAssignments[target.id];
                          const studentItem = ddSchema.bank.find((b) => b.id === studentItemId);
                          
                          const expectedItemId = ddSchema.correct?.[target.id];
                          const expectedItem = ddSchema.bank.find((b) => b.id === expectedItemId);

                          const isCorrect = expectedItemId ? studentItemId === expectedItemId : false;

                          let statusCell = null;
                          if (studentItem) {
                            if (showGradingKeys) {
                              statusCell = (
                                <span className={cn(
                                  "inline-flex items-center gap-1 font-bold",
                                  isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                )}>
                                  {isCorrect ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                  {studentItem.text}
                                </span>
                              );
                            } else {
                              statusCell = <span className="text-foreground font-semibold">{studentItem.text}</span>;
                            }
                          } else {
                            statusCell = <span className="text-muted-foreground italic">None placed</span>;
                          }

                          return (
                            <tr key={target.id} className="hover:bg-muted/5 transition-all">
                              <td className="p-3 font-medium text-foreground">{target.label}</td>
                              <td className="p-3">{statusCell}</td>
                              {showGradingKeys && (
                                <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">
                                  {expectedItem ? expectedItem.text : <span className="text-muted-foreground italic">—</span>}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. Text/Formula Responses */}
              {a.question.type !== "MCQ" && a.question.type !== "TRUE_FALSE" && a.question.type !== "DRAG_DROP" && (
                <div className="mt-3.5 p-3.5 rounded-lg border border-border/80 bg-muted/20 text-sm">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    {viewerIsProxy ? t("assessments.results.studentAnswer") : t("assessments.results.yourAnswer")}
                  </div>
                  <div className="whitespace-pre-wrap text-foreground font-semibold pl-3 border-l-2 border-primary/45">
                    {formatAnswerForDisplay(a.question.type, a.content, t)}
                  </div>
                </div>
              )}

              {/* 5. Additional Keys & AI feedback */}
              {showGradingKeys ? (
                <div className="space-y-3 mt-4 pt-4 border-t border-border/80 dark:border-white/10">
                  {a.question.correctAnswer && a.question.type !== "MCQ" && a.question.type !== "TRUE_FALSE" && (
                    <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-sm">
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                        {t("assessments.results.expected")}
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold pl-3 border-l-2 border-emerald-500/40">
                        {a.question.correctAnswer}
                      </div>
                    </div>
                  )}

                  {a.aiFeedback && (
                    <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 text-sm">
                      <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
                        {t("assessments.results.aiFeedback")}
                      </div>
                      <div className="text-foreground pl-3 border-l-2 border-purple-500/40 whitespace-pre-wrap leading-relaxed">
                        {a.aiFeedback}
                      </div>
                    </div>
                  )}

                  {a.manualComment && (
                    <div className="p-3 rounded-lg border border-teal-500/20 bg-teal-500/5 text-sm">
                      <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">
                        {t("assessments.results.instructor")}
                      </div>
                      <div className="text-foreground pl-3 border-l-2 border-teal-500/40">
                        {a.manualComment}
                      </div>
                    </div>
                  )}
                </div>
              ) : submission.status !== "DRAFT" && viewerIsProxy ? (
                <p className="mt-3 text-xs text-muted-foreground">{t("assessments.results.guardianHidden")}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
