"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { AssessmentPrompt } from "@/components/assessments/assessment-prompt";
import { AssessmentProctorHooks } from "@/components/assessments/assessment-proctor-hooks";

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
};

export function TakeAssessment({
  assessmentId,
  courseId,
  orgSlug,
}: {
  assessmentId: string;
  courseId: string;
  orgSlug: string;
}) {
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const autoSubmittedRef = useRef(false);

  const base = `/o/${orgSlug}/courses/${courseId}/assessments`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    autoSubmittedRef.current = false;
    try {
      const [aRes, sRes] = await Promise.all([
        fetch(`/api/assessments/${assessmentId}`, { credentials: "include" }),
        fetch(`/api/assessments/${assessmentId}/submissions`, { method: "POST", credentials: "include" }),
      ]);
      if (!aRes.ok) {
        setError("Could not load assessment");
        return;
      }
      const aData = (await aRes.json()) as {
        assessment: { title: string; timeLimitMinutes: number | null };
        questions: QuestionRow[];
      };
      setTitle(aData.assessment.title);
      setTimeLimit(aData.assessment.timeLimitMinutes);
      setQuestions(aData.questions);

      if (!sRes.ok) {
        setError("Could not start attempt");
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
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [assessmentId, courseId, orgSlug, router]);

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
        setError(d.error ?? "Submit failed (time expired)");
        autoSubmittedRef.current = false;
        return;
      }
      router.replace(`${base}/${assessmentId}/results?submissionId=${submissionId}`);
      router.refresh();
    })();
  }, [assessmentId, base, locked, remainingSec, router, submissionId, timeLimit]);

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
      setError(d.error ?? "Submit failed");
      return;
    }
    router.replace(`${base}/${assessmentId}/results?submissionId=${submissionId}`);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  if (error) return <p className="text-destructive">{error}</p>;
  if (locked || !submissionId) return null;

  const timedOut = remainingSec === 0 && timeLimit != null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {submissionId && !locked ? (
        <AssessmentProctorHooks assessmentId={assessmentId} submissionId={submissionId} />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            ← Assessments
          </Link>
          <h1 className="page-title mt-2">{title}</h1>
        </div>
        {remainingSec != null ? (
          <p className="text-sm tabular-nums text-muted-foreground">
            Time left: {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, "0")}
          </p>
        ) : null}
      </div>

      {timedOut ? (
        <p className="text-destructive">Time is up — submit now (answers saved periodically).</p>
      ) : null}

      <ol className="space-y-8">
        {questions.map((q, i) => (
          <li key={q.id} className="surface-bento p-5">
            <p className="text-sm text-muted-foreground">
              Question {i + 1} · {q.points} pt{q.points === 1 ? "" : "s"}
            </p>
            <AssessmentPrompt text={q.prompt} className="mt-1 font-medium" />
            {Array.isArray(q.mediaAttachments) && q.mediaAttachments.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {(q.mediaAttachments as MediaAtt[]).map((m, mi) =>
                  m.kind === "image" ? (
                    <li key={mi}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="" className="max-h-48 rounded-md border border-border object-contain" />
                    </li>
                  ) : m.kind === "video" ? (
                    <li key={mi}>
                      <a href={m.url} className="text-sm text-primary underline" target="_blank" rel="noreferrer">
                        Open video
                      </a>
                    </li>
                  ) : m.kind === "audio" ? (
                    <li key={mi}>
                      <audio controls className="w-full max-w-md" src={m.url} />
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}
            {q.type === "MCQ" && q.options?.choices ? (
              <div className="mt-3 space-y-2">
                {q.options.choices.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      checked={(() => {
                        try {
                          const j = JSON.parse(answers[q.id] || "{}") as { choiceId?: string };
                          return j.choiceId === c.id;
                        } catch {
                          return false;
                        }
                      })()}
                      onChange={() => setAnswer(q.id, JSON.stringify({ choiceId: c.id }))}
                    />
                    {c.text}
                  </label>
                ))}
              </div>
            ) : null}
            {q.type === "SHORT_ANSWER" ? (
              <Input
                className="mt-3"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            ) : null}
            {q.type === "LONG_ANSWER" || q.type === "ESSAY_RICH" ? (
              <Textarea
                className="mt-3"
                rows={6}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            ) : null}
            {q.type === "DRAG_DROP" || q.type === "FORMULA" ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-muted-foreground">
                  This question type is graded manually — use the text area if your teacher asked for a written response.
                </p>
                <Textarea
                  rows={4}
                  placeholder="Your response"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              </div>
            ) : null}
            {q.type === "TRUE_FALSE" ? (
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={`tf-${q.id}`}
                    checked={(() => {
                      try {
                        const j = JSON.parse(answers[q.id] || "{}") as { value?: boolean };
                        return j.value === true;
                      } catch {
                        return false;
                      }
                    })()}
                    onChange={() => setAnswer(q.id, JSON.stringify({ value: true }))}
                  />
                  True
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={`tf-${q.id}`}
                    checked={(() => {
                      try {
                        const j = JSON.parse(answers[q.id] || "{}") as { value?: boolean };
                        return j.value === false;
                      } catch {
                        return false;
                      }
                    })()}
                    onChange={() => setAnswer(q.id, JSON.stringify({ value: false }))}
                  />
                  False
                </label>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <Button type="button" disabled={submitting} onClick={() => void submit()}>
        {submitting ? "Submitting…" : "Submit assessment"}
      </Button>
    </div>
  );
}
