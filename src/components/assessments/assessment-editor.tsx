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
import type { EducationLevel } from "@/generated/prisma/enums";

type AssessmentMeta = {
  id: string;
  title: string;
  description: string | null;
  kind: "QUIZ" | "EXAM";
  semester: number | null;
  timeLimitMinutes: number | null;
  published: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswersToStudents: boolean;
  maxAttemptsPerStudent: number;
  retakeRequiresApproval: boolean;
};

type LinkedCohort = {
  id: string;
  name: string;
  gradeLabel: string | null;
  academicYearLabel: string;
};

type LinkedDepartment = {
  id: string;
  name: string;
  code: string | null;
  facultyDivisionName: string | null;
};

export function AssessmentEditor({
  orgSlug,
  courseId,
  educationLevel,
  initialAssessment,
  initialQuestions,
  linkedCourseCohorts = [],
  initialCohortIds = [],
  linkedCourseDepartments = [],
  initialDepartmentIds = [],
}: {
  orgSlug: string;
  courseId: string;
  educationLevel: EducationLevel;
  initialAssessment: AssessmentMeta;
  initialQuestions: Question[];
  linkedCourseCohorts?: LinkedCohort[];
  initialCohortIds?: string[];
  linkedCourseDepartments?: LinkedDepartment[];
  initialDepartmentIds?: string[];
}) {
  const router = useRouter();
  const aid = initialAssessment.id;
  const base = `/o/${orgSlug}/courses/${courseId}/assessments`;

  const [title, setTitle] = useState(initialAssessment.title);
  const [description, setDescription] = useState(initialAssessment.description ?? "");
  const [published, setPublished] = useState(initialAssessment.published);
  const [shuffle, setShuffle] = useState(initialAssessment.shuffleQuestions);
  const [shuffleOpts, setShuffleOpts] = useState(initialAssessment.shuffleOptions);
  const [showAnswers, setShowAnswers] = useState(initialAssessment.showAnswersToStudents);
  const [maxAttempts, setMaxAttempts] = useState(String(initialAssessment.maxAttemptsPerStudent));
  const [retakeApproval, setRetakeApproval] = useState(initialAssessment.retakeRequiresApproval);
  const [timeLimit, setTimeLimit] = useState(initialAssessment.timeLimitMinutes?.toString() ?? "");
  const [kind, setKind] = useState(initialAssessment.kind);
  const [semester, setSemester] = useState<string>(
    initialAssessment.semester == null ? "" : String(initialAssessment.semester),
  );
  const [questions, setQuestions] = useState(initialQuestions);
  const [busy, setBusy] = useState(false);
  const [selectedCohorts, setSelectedCohorts] = useState<Set<string>>(() => new Set(initialCohortIds));
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(() => new Set(initialDepartmentIds));

  const [qType, setQType] = useState<
    "MCQ" | "SHORT_ANSWER" | "LONG_ANSWER" | "TRUE_FALSE" | "DRAG_DROP" | "FORMULA" | "ESSAY_RICH"
  >("MCQ");
  const [qPrompt, setQPrompt] = useState("");
  const [qPoints, setQPoints] = useState("1");
  const [mcqTexts, setMcqTexts] = useState(["", "", "", ""]);
  const [mcqCorrect, setMcqCorrect] = useState(0);
  const [shortCorrect, setShortCorrect] = useState("");
  const [tfTrue, setTfTrue] = useState(true);
  const [ddTargets, setDdTargets] = useState<string[]>(["Label A", "Label B"]);
  const [ddBank, setDdBank] = useState<string[]>(["Item 1", "Item 2", "Item 3"]);
  const [ddMatch, setDdMatch] = useState<number[]>([0, 1]);
  const [formulaCorrect, setFormulaCorrect] = useState("");
  const [mediaImageUrl, setMediaImageUrl] = useState("");
  const [mediaAudioUrl, setMediaAudioUrl] = useState("");
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
          shuffleOptions: shuffleOpts,
          showAnswersToStudents: showAnswers,
          maxAttemptsPerStudent: Math.min(50, Math.max(1, Number(maxAttempts) || 1)),
          retakeRequiresApproval: retakeApproval,
          kind,
          semester: semester === "" ? null : Number(semester),
          timeLimitMinutes: tl != null && !Number.isNaN(tl) ? tl : null,
          ...(educationLevel === "HIGHER_ED" && linkedCourseDepartments.length > 0
            ? { departmentIds: [...selectedDepartments] }
            : {}),
          ...(educationLevel !== "HIGHER_ED" && linkedCourseCohorts.length > 0
            ? { cohortIds: [...selectedCohorts] }
            : {}),
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
      if (qType === "LONG_ANSWER" || qType === "ESSAY_RICH") {
        body = { ...body, markingScheme: aiOut.trim() || null };
      }
      if (qType === "TRUE_FALSE") {
        body = { ...body, correctAnswer: tfTrue ? "true" : "false" };
      }
      if (qType === "FORMULA") {
        body = { ...body, correctAnswer: formulaCorrect.trim() || null };
      }
      if (qType === "DRAG_DROP") {
        const targets = ddTargets
          .map((label, i) => ({ id: `t${i + 1}`, label: label.trim() }))
          .filter((t) => t.label.length > 0);
        const bank = ddBank
          .map((text, i) => ({ id: `b${i + 1}`, text: text.trim() }))
          .filter((b) => b.text.length > 0);
        if (targets.length < 1 || bank.length < 1) return;
        const correct: Record<string, string> = {};
        for (let i = 0; i < targets.length; i += 1) {
          const bi = ddMatch[i] ?? 0;
          const b = bank[bi];
          if (b) correct[targets[i]!.id] = b.id;
        }
        body = {
          ...body,
          questionSchema: { dragDrop: { targets, bank, correct } },
        };
      }
      function isHttpsUrl(s: string): boolean {
        try {
          const u = new URL(s);
          return u.protocol === "https:" || u.protocol === "http:";
        } catch {
          return false;
        }
      }
      const media: { kind: "image" | "audio"; url: string }[] = [];
      if (mediaImageUrl.trim() && isHttpsUrl(mediaImageUrl.trim())) {
        media.push({ kind: "image", url: mediaImageUrl.trim() });
      }
      if (mediaAudioUrl.trim() && isHttpsUrl(mediaAudioUrl.trim())) {
        media.push({ kind: "audio", url: mediaAudioUrl.trim() });
      }
      if (media.length > 0) {
        body = { ...body, mediaAttachments: media };
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
      setMediaImageUrl("");
      setMediaAudioUrl("");
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={shuffleOpts} onChange={(e) => setShuffleOpts(e.target.checked)} />
          Shuffle MCQ answer options for students
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
          Let students see correct answers / keys after they submit (quizzes & exams)
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Max submitted attempts per student</Label>
            <Input
              className="max-w-[120px]"
              type="number"
              min={1}
              max={50}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Additional tries after this need approval when enabled below.</p>
          </div>
          <label className="flex items-center gap-2 text-sm sm:mt-6">
            <input type="checkbox" checked={retakeApproval} onChange={(e) => setRetakeApproval(e.target.checked)} />
            Require teacher/admin approval for attempts beyond the max
          </label>
        </div>
        {educationLevel === "HIGHER_ED" && linkedCourseDepartments.length > 0 ? (
          <div className="rounded-md border border-border/80 bg-muted/30 p-3 dark:border-white/10">
            <p className="text-sm font-medium">Assign to departments</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Leave all unchecked so every enrolled student sees this assessment. Check departments to limit visibility
              (each must be linked to this course; you must be chair or instructor on that department).
            </p>
            <ul className="mt-3 space-y-2">
              {linkedCourseDepartments.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    id={`dept-${d.id}`}
                    checked={selectedDepartments.has(d.id)}
                    onChange={() => {
                      setSelectedDepartments((prev) => {
                        const next = new Set(prev);
                        if (next.has(d.id)) next.delete(d.id);
                        else next.add(d.id);
                        return next;
                      });
                    }}
                  />
                  <label htmlFor={`dept-${d.id}`} className="cursor-pointer">
                    {d.name}
                    {d.code ? ` · ${d.code}` : ""}
                    {d.facultyDivisionName ? ` (${d.facultyDivisionName})` : ""}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : educationLevel !== "HIGHER_ED" && linkedCourseCohorts.length > 0 ? (
          <div className="rounded-md border border-border/80 bg-muted/30 p-3 dark:border-white/10">
            <p className="text-sm font-medium">Assign to classes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Leave all unchecked so every enrolled student sees this assessment. Check specific classes to limit
              visibility (you must teach each class).
            </p>
            <ul className="mt-3 space-y-2">
              {linkedCourseCohorts.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    id={`cohort-${c.id}`}
                    checked={selectedCohorts.has(c.id)}
                    onChange={() => {
                      setSelectedCohorts((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      });
                    }}
                  />
                  <label htmlFor={`cohort-${c.id}`} className="cursor-pointer">
                    {c.name}
                    {c.gradeLabel ? ` · ${c.gradeLabel}` : ""}
                    {c.academicYearLabel ? ` (${c.academicYearLabel})` : ""}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {educationLevel === "HIGHER_ED"
              ? "Link departments to this course on the course edit page to target this assessment."
              : "Link classes to this course on the course edit page to target this assessment at specific homerooms."}
          </p>
        )}
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
            <option value="DRAG_DROP">Drag and drop (match labels to items)</option>
            <option value="FORMULA">Math / formula (LaTeX, auto-grade exact match)</option>
            <option value="ESSAY_RICH">Rich essay (manual / AI if marking scheme set)</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Prompt</Label>
          <Textarea
            rows={3}
            value={qPrompt}
            onChange={(e) => setQPrompt(e.target.value)}
            placeholder="Use $inline math$ or $$display math$$"
          />
        </div>
        <div className="space-y-1">
          <Label>Points</Label>
          <Input className="max-w-[120px]" value={qPoints} onChange={(e) => setQPoints(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Image URL (optional)</Label>
            <Input
              placeholder="https://…"
              value={mediaImageUrl}
              onChange={(e) => setMediaImageUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Audio URL (optional)</Label>
            <Input
              placeholder="https://…"
              value={mediaAudioUrl}
              onChange={(e) => setMediaAudioUrl(e.target.value)}
            />
          </div>
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
        {qType === "LONG_ANSWER" || qType === "ESSAY_RICH" ? (
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
        {qType === "FORMULA" ? (
          <div className="space-y-1">
            <Label>Correct LaTeX (normalized match: spacing / case ignored)</Label>
            <Input
              className="font-mono text-sm"
              value={formulaCorrect}
              onChange={(e) => setFormulaCorrect(e.target.value)}
              placeholder="e.g. x^2+1"
            />
          </div>
        ) : null}
        {qType === "DRAG_DROP" ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border p-3 dark:border-white/15">
            <p className="text-sm font-medium">Drop targets (labels shown to students)</p>
            {ddTargets.map((line, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={line}
                  onChange={(e) =>
                    setDdTargets((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDdTargets((prev) => prev.filter((_, j) => j !== i));
                    setDdMatch((prev) => prev.filter((_, j) => j !== i));
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setDdTargets((p) => [...p, ""])}>
              Add target
            </Button>
            <p className="text-sm font-medium">Answer bank (draggable items)</p>
            {ddBank.map((line, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={line}
                  onChange={(e) =>
                    setDdBank((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDdBank((prev) => prev.filter((_, j) => j !== i));
                    setDdMatch((prev) =>
                      prev.map((bi) => {
                        if (bi === i) return 0;
                        if (bi > i) return bi - 1;
                        return bi;
                      }),
                    );
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setDdBank((p) => [...p, ""])}>
              Add bank item
            </Button>
            <p className="text-sm font-medium">Correct match (each target → bank item)</p>
            <ul className="space-y-2">
              {ddTargets.map((label, ti) => (
                <li key={ti} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-[100px] truncate text-muted-foreground">{label || `Target ${ti + 1}`}</span>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2"
                    value={ddMatch[ti] ?? 0}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDdMatch((prev) => {
                        const next = [...prev];
                        while (next.length <= ti) next.push(0);
                        next[ti] = v;
                        return next;
                      });
                    }}
                  >
                    {ddBank.map((b, bi) => (
                      <option key={bi} value={bi}>
                        {b || `Item ${bi + 1}`}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Button type="button" disabled={busy} onClick={() => void addQuestion()}>
          Add question
        </Button>
      </section>
    </div>
  );
}
