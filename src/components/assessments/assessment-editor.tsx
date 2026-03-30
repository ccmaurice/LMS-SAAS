"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { Question } from "@/generated/prisma/client";

type AssessmentMeta = {
  id: string;
  title: string;
  description: string | null;
  kind: "QUIZ" | "EXAM";
  semester: number | null;
  timeLimitMinutes: number | null;
  published: boolean;
  shuffleQuestions: boolean;
};

export function AssessmentEditor({
  orgSlug,
  courseId,
  initialAssessment,
  initialQuestions,
}: {
  orgSlug: string;
  courseId: string;
  initialAssessment: AssessmentMeta;
  initialQuestions: Question[];
}) {
  const router = useRouter();
  const aid = initialAssessment.id;
  const base = `/o/${orgSlug}/courses/${courseId}/assessments`;

  const [title, setTitle] = useState(initialAssessment.title);
  const [description, setDescription] = useState(initialAssessment.description ?? "");
  const [published, setPublished] = useState(initialAssessment.published);
  const [shuffle, setShuffle] = useState(initialAssessment.shuffleQuestions);
  const [timeLimit, setTimeLimit] = useState(initialAssessment.timeLimitMinutes?.toString() ?? "");
  const [kind, setKind] = useState(initialAssessment.kind);
  const [semester, setSemester] = useState<string>(
    initialAssessment.semester == null ? "" : String(initialAssessment.semester),
  );
  const [questions, setQuestions] = useState(initialQuestions);
  const [busy, setBusy] = useState(false);

  const [qType, setQType] = useState<"MCQ" | "SHORT_ANSWER" | "LONG_ANSWER" | "TRUE_FALSE">("MCQ");
  const [qPrompt, setQPrompt] = useState("");
  const [qPoints, setQPoints] = useState("1");
  const [mcqTexts, setMcqTexts] = useState(["", "", "", ""]);
  const [mcqCorrect, setMcqCorrect] = useState(0);
  const [shortCorrect, setShortCorrect] = useState("");
  const [tfTrue, setTfTrue] = useState(true);
  const [aiTopic, setAiTopic] = useState("");
  const [aiOut, setAiOut] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  async function saveMeta() {
    setBusy(true);
    try {
      const tl = timeLimit.trim() === "" ? null : Number(timeLimit);
      await fetch(`/api/assessments/${aid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          description: description.trim() || null,
          published,
          shuffleQuestions: shuffle,
          kind,
          semester: semester === "" ? null : Number(semester),
          timeLimitMinutes: tl != null && !Number.isNaN(tl) ? tl : null,
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addQuestion() {
    if (!qPrompt.trim()) return;
    setBusy(true);
    try {
      let body: Record<string, unknown> = {
        type: qType,
        prompt: qPrompt.trim(),
        points: Number(qPoints) || 1,
      };
      if (qType === "MCQ") {
        const choices = mcqTexts
          .map((t, i) => ({
            id: String.fromCharCode(97 + i),
            text: t.trim(),
            correct: i === mcqCorrect,
          }))
          .filter((c) => c.text.length > 0);
        if (choices.length < 2) return;
        body = { ...body, options: { choices } };
      }
      if (qType === "SHORT_ANSWER") {
        body = { ...body, correctAnswer: shortCorrect.trim() || null };
      }
      if (qType === "LONG_ANSWER") {
        body = { ...body, markingScheme: aiOut.trim() || null };
      }
      if (qType === "TRUE_FALSE") {
        body = { ...body, correctAnswer: tfTrue ? "true" : "false" };
      }
      const res = await fetch(`/api/assessments/${aid}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { question: Question };
      setQuestions((q) => [...q, data.question]);
      setQPrompt("");
      setMcqTexts(["", "", "", ""]);
      setShortCorrect("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(id: string) {
    if (!confirm("Delete this question?")) return;
    const res = await fetch(`/api/questions/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return;
    setQuestions((q) => q.filter((x) => x.id !== id));
    router.refresh();
  }

  async function importFromPdf(file: File) {
    setPdfBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/ai/assessment-from-document", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = (await res.json()) as { error?: string; questions?: { type: string; prompt: string; points?: number; correctAnswer?: string | null; options?: unknown; markingScheme?: string | null }[] };
      if (!res.ok || !data.questions?.length) {
        alert(data.error ?? "Could not generate questions (check API key & PDF).");
        return;
      }
      for (const q of data.questions) {
        const r = await fetch(`/api/assessments/${aid}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: q.type,
            prompt: q.prompt,
            points: q.points ?? 1,
            options: q.options,
            correctAnswer: q.correctAnswer ?? null,
            markingScheme: q.markingScheme ?? null,
          }),
        });
        if (!r.ok) continue;
        const row = (await r.json()) as { question: Question };
        setQuestions((prev) => [...prev, row.question]);
      }
      router.refresh();
    } finally {
      setPdfBusy(false);
    }
  }

  async function suggestRubric() {
    setBusy(true);
    try {
      const res = await fetch("/api/ai/suggest-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic: aiTopic || title, questionPrompt: qPrompt }),
      });
      const data = (await res.json()) as { text?: string };
      setAiOut(data.text ?? "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        ← Assessments
      </Link>

      <section className="surface-bento space-y-3 p-5">
        <h2 className="text-lg font-semibold">Settings</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Kind</Label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as "QUIZ" | "EXAM")}
            >
              <option value="QUIZ">Quiz (continuous assessment)</option>
              <option value="EXAM">Exam</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Semester (for promotion rollups)</Label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="">Not set</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Time limit (minutes, empty = none)</Label>
            <Input value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
          Shuffle questions for students
        </label>
        <Button type="button" disabled={busy} onClick={() => void saveMeta()}>
          Save settings
        </Button>
        <Link
          href={`${base}/${aid}/gradebook`}
          className={cn(buttonVariants({ variant: "outline" }), "ml-2 inline-flex")}
        >
          Gradebook
        </Link>
        <div className="mt-4 rounded-md border border-dashed border-border p-3 text-sm">
          <Label className="text-foreground">AI: questions from PDF (Gemini)</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Set <code className="rounded bg-muted px-1">GOOGLE_AI_API_KEY</code> or{" "}
            <code className="rounded bg-muted px-1">GEMINI_API_KEY</code>. PDF text is extracted server-side.
          </p>
          <input
            type="file"
            accept="application/pdf"
            className="mt-2 block text-xs"
            disabled={pdfBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFromPdf(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Questions</h2>
        <ul className="space-y-2">
          {questions.map((q, i) => (
            <li key={q.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border p-3">
              <div>
                <span className="text-xs text-muted-foreground">
                  {i + 1}. {q.type} · {q.points} pts
                </span>
                <p className="text-sm whitespace-pre-wrap">{q.prompt}</p>
              </div>
              <Button type="button" size="sm" variant="destructive" onClick={() => void removeQuestion(q.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
        {questions.length === 0 ? <p className="text-sm text-muted-foreground">No questions yet.</p> : null}
      </section>

      <Separator />

      <section className="space-y-3 rounded-lg border border-dashed border-border p-4">
        <h2 className="text-lg font-semibold">Add question</h2>
        <div className="space-y-1">
          <Label>Type</Label>
          <select
            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
            value={qType}
            onChange={(e) => setQType(e.target.value as typeof qType)}
          >
            <option value="MCQ">Multiple choice</option>
            <option value="SHORT_ANSWER">Short answer (auto-grade exact match)</option>
            <option value="LONG_ANSWER">Long answer (AI / manual grade)</option>
            <option value="TRUE_FALSE">True / false</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Prompt</Label>
          <Textarea rows={3} value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Points</Label>
          <Input className="max-w-[120px]" value={qPoints} onChange={(e) => setQPoints(e.target.value)} />
        </div>
        {qType === "MCQ" ? (
          <div className="space-y-2">
            <Label>Choices (mark correct)</Label>
            {mcqTexts.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mcq-correct"
                  checked={mcqCorrect === i}
                  onChange={() => setMcqCorrect(i)}
                />
                <Input value={t} onChange={(e) => setMcqTexts((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>
            ))}
          </div>
        ) : null}
        {qType === "SHORT_ANSWER" ? (
          <div className="space-y-1">
            <Label>Correct answer (case-insensitive match)</Label>
            <Input value={shortCorrect} onChange={(e) => setShortCorrect(e.target.value)} />
          </div>
        ) : null}
        {qType === "TRUE_FALSE" ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={tfTrue} onChange={(e) => setTfTrue(e.target.checked)} />
            Correct answer is True (uncheck for False)
          </label>
        ) : null}
        {qType === "LONG_ANSWER" ? (
          <div className="space-y-2">
            <Label>AI marking scheme helper</Label>
            <Input placeholder="Topic / focus" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void suggestRubric()}>
              Suggest rubric (AI or mock)
            </Button>
            {aiOut ? (
              <Textarea readOnly rows={5} value={aiOut} className="text-muted-foreground" />
            ) : null}
          </div>
        ) : null}
        <Button type="button" disabled={busy} onClick={() => void addQuestion()}>
          Add question
        </Button>
      </section>
    </div>
  );
}
