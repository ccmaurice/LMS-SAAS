"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  FileQuestion,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { AssessmentQuestionText } from "@/components/assessments/assessment-question-text";
import { AssessmentRichTextField } from "@/components/assessments/assessment-rich-text-field";
import { stripHtmlToPlainText } from "@/lib/assessments/html-text";
import { AssessmentDeliveryIntegrity } from "@/components/assessments/assessment-delivery-integrity";
import { AssessmentLockdownGuards } from "@/components/assessments/assessment-lockdown-guards";
import { AssessmentProctorHooks } from "@/components/assessments/assessment-proctor-hooks";
import { AssessmentDragDrop } from "@/components/assessments/assessment-drag-drop";
import { FormulaAnswerField } from "@/components/assessments/formula-answer-field";
import { parseDragDropFromQuestionSchema } from "@/lib/assessments/drag-drop-schema";

type Choice = { id: string; text: string };
type MediaAtt = { kind: string; url: string };

type QuestionRow = {
  id: string;
  type:
    | "MCQ"
    | "SHORT_ANSWER"
    | "LONG_ANSWER"
    | "TRUE_FALSE"
    | "DRAG_DROP"
    | "ESSAY_RICH"
    | "FORMULA";
  prompt: string;
  points: number;
  options?: { choices: Choice[] } | null;
  mediaAttachments?: unknown;
  questionSchema?: unknown;
};

function defaultAnswerForType(t: QuestionRow["type"]): string {
  if (t === "DRAG_DROP") return JSON.stringify({ assignments: {} });
  if (t === "FORMULA") return JSON.stringify({ latex: "" });
  if (t === "TRUE_FALSE") return "";
  return "";
}

function formatHMS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Whether the learner has provided a non-empty response (for progress dots / submit hints). */
function isQuestionAnswered(q: QuestionRow, raw: string | undefined): boolean {
  const v = raw ?? "";
  switch (q.type) {
    case "MCQ":
      try {
        const j = JSON.parse(v || "{}") as { choiceId?: string };
        return Boolean(j.choiceId);
      } catch {
        return false;
      }
    case "SHORT_ANSWER":
    case "LONG_ANSWER":
    case "ESSAY_RICH":
      return stripHtmlToPlainText(v).length > 0;
    case "TRUE_FALSE": {
      try {
        const j = JSON.parse(v || "{}") as { value?: boolean };
        return typeof j.value === "boolean";
      } catch {
        return false;
      }
    }
    case "DRAG_DROP":
      try {
        const j = JSON.parse(v || "{}") as { assignments?: Record<string, string> };
        const a = j.assignments ?? {};
        return Object.values(a).some((x) => x != null && String(x).length > 0);
      } catch {
        return false;
      }
    case "FORMULA":
      try {
        const j = JSON.parse(v || "{}") as { latex?: string };
        return Boolean(j.latex?.trim());
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function AssessmentChromeLink({
  href,
  className,
  children,
  ariaLabel,
  requireLeaveConfirm,
  leaveMessage,
  router,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  ariaLabel: string;
  requireLeaveConfirm: boolean;
  leaveMessage: string;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        if (!requireLeaveConfirm) return;
        e.preventDefault();
        if (window.confirm(leaveMessage)) {
          router.push(href);
        }
      }}
    >
      {children}
    </Link>
  );
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.closest("[data-lockdown-allow-input]")) return true;
  return false;
}

function SidebarCard({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm dark:border-white/10">
      {accent ? <div className="h-1 w-10 rounded-b-sm bg-amber-400 dark:bg-amber-500" /> : null}
      <div className="p-4 pt-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

export function TakeAssessment({
  assessmentId,
  courseId,
  orgSlug,
}: {
  assessmentId: string;
  courseId: string;
  orgSlug: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"FORMATIVE" | "SECURE_ONLINE" | "LOCKDOWN">("FORMATIVE");
  const [currentIdx, setCurrentIdx] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const autoSubmittedRef = useRef(false);

  const base = `/o/${orgSlug}/courses/${courseId}/assessments`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    autoSubmittedRef.current = false;
    setCurrentIdx(0);
    try {
      const [aRes, sRes] = await Promise.all([
        fetch(`/api/assessments/${assessmentId}`, { credentials: "include" }),
        fetch(`/api/assessments/${assessmentId}/submissions`, { method: "POST", credentials: "include" }),
      ]);
      if (!aRes.ok) {
        setError(t("assessments.take.loadError"));
        return;
      }
      const aData = (await aRes.json()) as {
        assessment: {
          title: string;
          timeLimitMinutes: number | null;
          deliveryMode?: "FORMATIVE" | "SECURE_ONLINE" | "LOCKDOWN";
        };
        questions: QuestionRow[];
      };
      setTitle(aData.assessment.title);
      setTimeLimit(aData.assessment.timeLimitMinutes);
      setDeliveryMode(aData.assessment.deliveryMode ?? "FORMATIVE");
      setQuestions(aData.questions);

      if (!sRes.ok) {
        try {
          const errBody = (await sRes.json()) as { error?: string; code?: string };
          if (errBody.code === "ATTEMPTS_LOCKED") {
            setError(errBody.error ?? t("assessments.take.attemptsLockedDefault"));
          } else {
            setError(errBody.error ?? t("assessments.take.startAttemptError"));
          }
        } catch {
          setError(t("assessments.take.startAttemptError"));
        }
        return;
      }
      const sData = (await sRes.json()) as {
        submission: { id: string; startedAt: string; status: string };
        locked?: boolean;
      };
      setSubmissionId(sData.submission.id);
      setStartedAt(new Date(sData.submission.startedAt));
      setLocked(Boolean(sData.locked));
      if (sData.locked) {
        router.replace(
          `/o/${orgSlug}/courses/${courseId}/assessments/${assessmentId}/results?submissionId=${sData.submission.id}`,
        );
      } else {
        setAnswers(() => {
          const init: Record<string, string> = {};
          for (const q of aData.questions) {
            init[q.id] = defaultAnswerForType(q.type);
          }
          return init;
        });
      }
    } catch {
      setError(t("assessments.take.networkError"));
    } finally {
      setLoading(false);
    }
  }, [assessmentId, courseId, orgSlug, router, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (locked || timeLimit == null || startedAt == null) {
      setRemainingSec(null);
      return;
    }
    const limitSec = timeLimit * 60;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      setRemainingSec(Math.max(0, limitSec - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [locked, timeLimit, startedAt]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    const strict = deliveryMode !== "FORMATIVE";
    if (!strict || locked || !submissionId || submitting) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [deliveryMode, locked, submissionId, submitting]);

  useEffect(() => {
    if (remainingSec !== 0 || timeLimit == null || locked || !submissionId || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    void (async () => {
      setSubmitting(true);
      const res = await fetch(`/api/submissions/${submissionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answers: answersRef.current }),
      });
      setSubmitting(false);
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? t("assessments.take.submitFailedTime"));
        autoSubmittedRef.current = false;
        return;
      }
      router.replace(`${base}/${assessmentId}/results?submissionId=${submissionId}`);
      router.refresh();
    })();
  }, [assessmentId, base, locked, remainingSec, router, submissionId, timeLimit]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentIdx]);

  useEffect(() => {
    const timedOutNow = remainingSec === 0 && timeLimit != null;
    if (questions.length === 0 || submitting || timedOutNow) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      if (e.key === "ArrowLeft") setCurrentIdx((i) => Math.max(0, i - 1));
      else setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [questions.length, remainingSec, timeLimit, submitting]);

  const saveDraft = useMemo(
    () => (sid: string, payload: Record<string, string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void fetch(`/api/submissions/${sid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ answers: payload }),
        });
      }, 800);
    },
    [],
  );

  function setAnswer(qid: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: value };
      if (submissionId && !locked) saveDraft(submissionId, next);
      return next;
    });
  }

  function clearCurrentAnswer() {
    const q = questions[currentIdx];
    if (!q || !submissionId || locked) return;
    setAnswer(q.id, defaultAnswerForType(q.type));
  }

  async function submit() {
    if (!submissionId || locked || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/submissions/${submissionId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ answers: answersRef.current }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? t("assessments.take.submitFailed"));
      return;
    }
    router.replace(`${base}/${assessmentId}/results?submissionId=${submissionId}`);
    router.refresh();
  }

  const totalLimitSec = timeLimit != null ? timeLimit * 60 : null;
  const timedOut = remainingSec === 0 && timeLimit != null;
  const proctorEnabled = deliveryMode !== "FORMATIVE";
  const lockdownUi = deliveryMode === "LOCKDOWN";

  const q = questions[currentIdx];
  const n = questions.length;
  const displayIndex = n === 0 ? 0 : currentIdx + 1;
  const unansweredCount = useMemo(
    () => questions.filter((qq) => !isQuestionAnswered(qq, answers[qq.id])).length,
    [questions, answers],
  );
  const requireLeaveConfirm = deliveryMode !== "FORMATIVE";
  const timeRunningLow = remainingSec != null && remainingSec > 0 && remainingSec <= 300;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <Skeleton className="min-h-[320px] rounded-xl lg:col-span-8" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-6 dark:border-destructive/40 dark:bg-destructive/10">
        <p className="font-medium text-destructive">{error}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("assessments.take.retryHint")}</p>
        <Button type="button" className="mt-4" variant="outline" onClick={() => void load()}>
          {t("assessments.take.tryAgain")}
        </Button>
      </div>
    );
  }
  if (locked || !submissionId) return null;

  const dd = q?.type === "DRAG_DROP" ? parseDragDropFromQuestionSchema(q.questionSchema) : null;

  return (
    <AssessmentLockdownGuards active={lockdownUi}>
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-28">
        {submissionId && !locked ? (
          <AssessmentProctorHooks
            assessmentId={assessmentId}
            submissionId={submissionId}
            enabled={proctorEnabled}
          />
        ) : null}
        {submissionId && !locked ? <AssessmentDeliveryIntegrity mode={deliveryMode} /> : null}

        {/* Top chrome — similar to reference: title bar + exit */}
        <header className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm dark:border-white/10">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <AssessmentChromeLink
              href={base}
              requireLeaveConfirm={requireLeaveConfirm}
              leaveMessage={t("assessments.take.leaveConfirm")}
              router={router}
              ariaLabel={t("assessments.take.ariaBack")}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground",
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </AssessmentChromeLink>
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground md:text-lg">{title}</h1>
          </div>
          <AssessmentChromeLink
            href={base}
            requireLeaveConfirm={requireLeaveConfirm}
            leaveMessage={t("assessments.take.leaveConfirm")}
            router={router}
            ariaLabel={t("assessments.take.ariaClose")}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground",
            )}
          >
            <X className="h-5 w-5" />
          </AssessmentChromeLink>
        </header>

        {timedOut ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t("assessments.take.timeUpBanner")}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <aside className="space-y-4 lg:col-span-4 lg:sticky lg:top-4 lg:self-start">
            <SidebarCard title={t("assessments.take.sidebarTime")} icon={Clock}>
              <dl className="space-y-2 text-sm tabular-nums">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">{t("assessments.take.totalTime")}</dt>
                  <dd className="font-medium text-foreground">
                    {totalLimitSec != null ? formatHMS(totalLimitSec) : t("assessments.take.untimed")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">{t("assessments.take.remainTime")}</dt>
                  <dd
                    className={cn(
                      "font-semibold",
                      timeRunningLow ? "text-amber-700 dark:text-amber-400" : "text-foreground",
                    )}
                  >
                    {remainingSec != null ? formatHMS(remainingSec) : t("assessments.take.untimed")}
                  </dd>
                </div>
                {timeRunningLow ? (
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200/90">
                    {t("assessments.take.fiveMinWarning")}
                  </p>
                ) : null}
              </dl>
            </SidebarCard>

            <SidebarCard title={t("assessments.take.questionMapTitle")} icon={CircleHelp} accent>
              <div
                className="flex flex-wrap gap-2"
                role="navigation"
                aria-label="Jump to question"
              >
                {questions.map((item, i) => {
                  const active = i === currentIdx;
                  const answered = isQuestionAnswered(item, answers[item.id]);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? "step" : undefined}
                      aria-label={`${t("assessments.take.questionWord")} ${i + 1}${answered ? t("assessments.take.ariaAnswered") : t("assessments.take.ariaNotAnswered")}${active ? t("assessments.take.ariaCurrent") : ""}`}
                      className={cn(
                        "flex h-9 min-w-9 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                        active
                          ? "border-amber-500 bg-amber-400 text-amber-950 shadow-sm ring-2 ring-amber-500/30 dark:border-amber-400 dark:bg-amber-500 dark:text-amber-950 dark:ring-amber-400/25"
                          : answered
                            ? "border-emerald-500/70 bg-emerald-50 text-emerald-900 hover:bg-emerald-100/80 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25"
                            : "border-border/90 bg-background text-muted-foreground hover:border-amber-400/50 hover:bg-muted/40 dark:border-white/15 dark:hover:border-amber-500/40",
                      )}
                      onClick={() => setCurrentIdx(i)}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] leading-snug text-muted-foreground">{t("assessments.take.legendDots")}</p>
            </SidebarCard>
          </aside>

          <section className="lg:col-span-8">
            {n === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
                {t("assessments.take.noQuestions")}
              </p>
            ) : q ? (
              <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm dark:border-white/10">
                <div className="border-b border-border/70 px-5 py-4 dark:border-white/10">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileQuestion className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    {t("assessments.take.questionProgress").replace("%s", String(displayIndex)).replace("%s", String(n))}
                  </div>
                  <AssessmentQuestionText
                    text={q.prompt}
                    className="mt-3 text-lg font-medium leading-snug tracking-tight text-foreground"
                  />
                </div>

                <div className="px-5 py-5">
                  {Array.isArray(q.mediaAttachments) && q.mediaAttachments.length > 0 ? (
                    <ul className="mb-5 space-y-3">
                      {(q.mediaAttachments as MediaAtt[]).map((m, mi) =>
                        m.kind === "image" ? (
                          <li
                            key={mi}
                            className="overflow-hidden rounded-xl border border-border bg-muted/20 dark:border-white/10"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.url} alt="" className="max-h-64 w-full object-contain" />
                          </li>
                        ) : m.kind === "video" ? (
                          <li key={mi} className="overflow-hidden rounded-xl border border-border dark:border-white/10">
                            <video controls className="max-h-72 w-full bg-black" src={m.url}>
                              <track kind="captions" />
                            </video>
                          </li>
                        ) : m.kind === "audio" ? (
                          <li
                            key={mi}
                            className="rounded-xl border border-border bg-muted/20 px-3 py-2 dark:border-white/10"
                          >
                            <audio controls className="w-full max-w-md" src={m.url} />
                          </li>
                        ) : null,
                      )}
                    </ul>
                  ) : null}

                  {q.type === "MCQ" && q.options?.choices ? (
                    <div className="space-y-2">
                      {q.options.choices.map((c) => {
                        const checked = (() => {
                          try {
                            const j = JSON.parse(answers[q.id] || "{}") as { choiceId?: string };
                            return j.choiceId === c.id;
                          } catch {
                            return false;
                          }
                        })();
                        return (
                          <label
                            key={c.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-colors",
                              checked
                                ? "border-amber-400/80 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10"
                                : "border-border/80 bg-background hover:bg-muted/30 dark:border-white/12",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2",
                                checked
                                  ? "border-amber-600 bg-amber-500 dark:border-amber-400 dark:bg-amber-400"
                                  : "border-muted-foreground/40 bg-background",
                              )}
                              aria-hidden
                            >
                              {checked ? (
                                <span className="block h-2 w-2 rounded-[1px] bg-amber-950 dark:bg-amber-950" />
                              ) : null}
                            </span>
                            <input
                              type="radio"
                              name={q.id}
                              className="sr-only"
                              checked={checked}
                              onChange={() => setAnswer(q.id, JSON.stringify({ choiceId: c.id }))}
                            />
                            <AssessmentQuestionText text={c.text} className="flex-1 leading-relaxed" />
                          </label>
                        );
                      })}
                    </div>
                  ) : null}

                  {q.type === "SHORT_ANSWER" ? (
                    <AssessmentRichTextField
                      value={answers[q.id] ?? ""}
                      onChange={(html) => setAnswer(q.id, html)}
                      placeholder={t("assessments.take.placeholderShort")}
                      editorMinHeightClass="min-h-[100px]"
                      lockdownAllowInput
                      variant="respondent"
                    />
                  ) : null}

                  {q.type === "LONG_ANSWER" || q.type === "ESSAY_RICH" ? (
                    <AssessmentRichTextField
                      value={answers[q.id] ?? ""}
                      onChange={(html) => setAnswer(q.id, html)}
                      placeholder={t("assessments.take.placeholderLong")}
                      editorMinHeightClass={q.type === "ESSAY_RICH" ? "min-h-[220px]" : "min-h-[180px]"}
                      lockdownAllowInput
                      variant="respondent"
                    />
                  ) : null}

                  {q.type === "DRAG_DROP" ? (
                    dd ? (
                      <AssessmentDragDrop
                        questionId={q.id}
                        targets={dd.targets}
                        bank={dd.bank}
                        valueJson={answers[q.id] ?? JSON.stringify({ assignments: {} })}
                        onChange={(json) => setAnswer(q.id, json)}
                      />
                    ) : (
                      <p className="text-sm text-destructive">
                        {t("assessments.take.ddBroken")}
                      </p>
                    )
                  ) : null}

                  {q.type === "FORMULA" ? (
                    <FormulaAnswerField
                      valueJson={answers[q.id] ?? JSON.stringify({ latex: "" })}
                      onChange={(json) => setAnswer(q.id, json)}
                    />
                  ) : null}

                  {q.type === "TRUE_FALSE" ? (
                    <div className="space-y-2">
                      {(
                        [
                          { v: true as const, label: t("assessments.take.boolTrue") },
                          { v: false as const, label: t("assessments.take.boolFalse") },
                        ] as const
                      ).map(({ v, label }) => {
                        let selected: boolean | null = null;
                        try {
                          const raw = answers[q.id]?.trim();
                          if (raw) {
                            const j = JSON.parse(raw) as { value?: boolean };
                            if (typeof j.value === "boolean") selected = j.value;
                          }
                        } catch {
                          selected = null;
                        }
                        const checked = selected === v;
                        return (
                          <label
                            key={String(v)}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition-colors",
                              checked
                                ? "border-amber-400/80 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10"
                                : "border-border/80 bg-background hover:bg-muted/30 dark:border-white/12",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2",
                                checked
                                  ? "border-amber-600 bg-amber-500 dark:border-amber-400 dark:bg-amber-400"
                                  : "border-muted-foreground/40 bg-background",
                              )}
                              aria-hidden
                            >
                              {checked ? (
                                <span className="block h-2 w-2 rounded-[1px] bg-amber-950" />
                              ) : null}
                            </span>
                            <input
                              type="radio"
                              name={`tf-${q.id}`}
                              className="sr-only"
                              checked={checked}
                              onChange={() => setAnswer(q.id, JSON.stringify({ value: v }))}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                {/* Marks bar — reference-style solid blue strip */}
                <div className="flex items-center bg-blue-600 px-5 py-2.5 text-sm font-medium text-white dark:bg-blue-700">
                  <span className="tabular-nums">
                    {t("assessments.take.marksLine").replace("%s", Number(q.points).toFixed(2))}
                  </span>
                </div>
              </div>
            ) : null}

            {n > 0 ? (
              <div className="mt-6 space-y-3">
                <p className="text-xs text-muted-foreground">{t("assessments.take.tipShift")}</p>
                {unansweredCount > 0 ? (
                  <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-100">
                    {unansweredCount === 1
                      ? t("assessments.take.unansweredOne")
                      : t("assessments.take.unansweredMany").replace("%s", String(unansweredCount))}{" "}
                    {t("assessments.take.unansweredFooter")}
                  </p>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-w-[7rem] gap-1 border-border/90 bg-background"
                      disabled={currentIdx <= 0 || submitting}
                      onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t("assessments.take.previous")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-w-[7rem] gap-1 border-border/90 bg-background"
                      disabled={currentIdx >= n - 1 || submitting}
                      onClick={() => setCurrentIdx((i) => Math.min(n - 1, i + 1))}
                    >
                      {t("assessments.take.next")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-1.5"
                      disabled={submitting || timedOut}
                      onClick={() => clearCurrentAnswer()}
                    >
                      <X className="h-4 w-4" />
                      {t("assessments.take.clearAnswer")}
                    </Button>
                    <Button
                      type="button"
                      className="gap-1.5"
                      disabled={submitting || timedOut}
                      onClick={() => void submit()}
                    >
                      <Check className="h-4 w-4" />
                      {submitting ? t("assessments.take.submitting") : t("assessments.take.submit")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </AssessmentLockdownGuards>
  );
}
