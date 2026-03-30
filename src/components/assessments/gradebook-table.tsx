"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AssessmentPrompt } from "@/components/assessments/assessment-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type AnswerRow = {
  id: string;
  questionId: string;
  content: string;
  score: number | null;
  aiScore: number | null;
  manualScore: number | null;
  manualComment: string | null;
  autoGraded: boolean;
  question: { type: string; prompt: string; points: number };
};

type SubRow = {
  id: string;
  status: string;
  totalScore: number | null;
  maxScore: number | null;
  user: { name: string | null; email: string };
  answers: AnswerRow[];
};

export function GradebookTable({ initial }: { initial: SubRow[] }) {
  const router = useRouter();
  const [subs, setSubs] = useState(initial);

  async function saveGrade(answerId: string, manualScore: number, manualComment: string) {
    const res = await fetch(`/api/answers/${answerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ manualScore, manualComment: manualComment || null }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      answer: { id: string; manualScore: number | null; manualComment: string | null };
      submission: { id: string; totalScore: number | null; maxScore: number | null; status: string };
    };
    setSubs((prev) =>
      prev.map((s) => {
        if (s.id !== data.submission.id) return s;
        return {
          ...s,
          totalScore: data.submission.totalScore,
          maxScore: data.submission.maxScore,
          status: data.submission.status,
          answers: s.answers.map((a) =>
            a.id === answerId
              ? {
                  ...a,
                  manualScore: data.answer.manualScore,
                  manualComment: data.answer.manualComment,
                }
              : a,
          ),
        };
      }),
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {subs.map((s) => (
        <div key={s.id} className="surface-bento p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{s.user.name ?? s.user.email}</p>
            <p className="text-sm text-muted-foreground">
              {s.status} · Score {s.totalScore ?? "—"} / {s.maxScore ?? "—"}
            </p>
          </div>
          <ul className="mt-4 space-y-4">
            {s.answers.map((a) => (
              <li key={a.id} className="border-t border-border/80 pt-4 text-sm dark:border-white/10">
                <p className="text-xs text-muted-foreground">
                  {a.question.type} · {a.question.points} pts
                  {a.autoGraded ? " · auto-graded" : ""}
                </p>
                <AssessmentPrompt text={a.question.prompt} className="mt-1 font-medium" />
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{a.content || "(empty)"}</p>
                <p className="mt-1 text-xs">
                  Auto/AI score: {a.score ?? "—"}
                  {a.aiScore != null && a.aiScore !== a.score ? ` (AI ${a.aiScore})` : ""} · Manual override:{" "}
                  {a.manualScore ?? "—"}
                </p>
                {(a.question.type === "LONG_ANSWER" || !a.autoGraded) && (
                  <GradeRow
                    max={a.question.points}
                    initialScore={a.manualScore ?? ""}
                    initialComment={a.manualComment ?? ""}
                    onSave={(score, comment) => void saveGrade(a.id, score, comment)}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {subs.length === 0 ? <p className="text-muted-foreground">No submissions yet.</p> : null}
    </div>
  );
}

function GradeRow({
  max,
  initialScore,
  initialComment,
  onSave,
}: {
  max: number;
  initialScore: number | "";
  initialComment: string;
  onSave: (score: number, comment: string) => void;
}) {
  const [score, setScore] = useState(initialScore === "" ? "" : String(initialScore));
  const [comment, setComment] = useState(initialComment);

  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
      <div>
        <label className="text-xs text-muted-foreground">Manual score (max {max})</label>
        <Input
          className="mt-0.5 max-w-[100px]"
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />
      </div>
      <div className="min-w-0 flex-1">
        <label className="text-xs text-muted-foreground">Comment</label>
        <Textarea className="mt-0.5" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          const n = Number(score);
          if (Number.isNaN(n)) return;
          onSave(Math.min(max, Math.max(0, n)), comment);
        }}
      >
        Save grade
      </Button>
    </div>
  );
}
