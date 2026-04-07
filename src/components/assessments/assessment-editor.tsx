"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlignLeft,
  CheckCircle2,
  FileText,
  GripVertical,
  ListChecks,
  PenLine,
  Plus,
  Sigma,
  Sparkles,
  ToggleLeft,
  Trash2,
} from "lucide-react";
import { AssessmentQuestionBankPanel } from "@/components/assessments/assessment-question-bank-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { Question } from "@/generated/prisma/client";
import type { EducationLevel } from "@/generated/prisma/enums";
import {
  AssessmentScheduleEditor,
  type ScheduleEntryClient,
} from "@/components/assessments/assessment-schedule-editor";
import { AssessmentFormFieldRow } from "@/components/assessments/assessment-form-field-row";
import { AssessmentRichTextField } from "@/components/assessments/assessment-rich-text-field";
import { isRichTextEmpty, stripHtmlToPlainText } from "@/lib/assessments/html-text";

type AssessmentMeta = {
  id: string;
  title: string;
  description: string | null;
  kind: "QUIZ" | "EXAM";
  semester: number | null;
  timeLimitMinutes: number | null;
  published: boolean;
  studentAttemptsLocked: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswersToStudents: boolean;
  maxAttemptsPerStudent: number;
  retakeRequiresApproval: boolean;
  deliveryMode: "FORMATIVE" | "SECURE_ONLINE" | "LOCKDOWN";
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

type BuilderQType =
  | "MCQ"
  | "SHORT_ANSWER"
  | "LONG_ANSWER"
  | "TRUE_FALSE"
  | "DRAG_DROP"
  | "FORMULA"
  | "ESSAY_RICH";

const BUILDER_TYPE_OPTIONS: {
  value: BuilderQType;
  label: string;
  hint: string;
  icon: typeof ListChecks;
}[] = [
  { value: "MCQ", label: "Multiple choice", hint: "Single correct option", icon: ListChecks },
  { value: "SHORT_ANSWER", label: "Short answer", hint: "Exact text match", icon: AlignLeft },
  { value: "LONG_ANSWER", label: "Long answer", hint: "Manual / AI assist", icon: FileText },
  { value: "TRUE_FALSE", label: "True / false", hint: "Binary choice", icon: ToggleLeft },
  { value: "DRAG_DROP", label: "Drag & drop", hint: "Match pairs", icon: GripVertical },
  { value: "FORMULA", label: "Formula", hint: "LaTeX answer", icon: Sigma },
  { value: "ESSAY_RICH", label: "Rich essay", hint: "Extended response", icon: PenLine },
];

function questionTypeLabel(t: string): string {
  const row = BUILDER_TYPE_OPTIONS.find((x) => x.value === t);
  return row?.label ?? t;
}

export function AssessmentEditor({
  orgSlug,
  courseId,
  educationLevel,
  initialAssessment,
  initialScheduleEntries,
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
  initialScheduleEntries: ScheduleEntryClient[];
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
  const [studentAttemptsLocked, setStudentAttemptsLocked] = useState(
    initialAssessment.studentAttemptsLocked,
  );
  const [shuffle, setShuffle] = useState(initialAssessment.shuffleQuestions);
  const [shuffleOpts, setShuffleOpts] = useState(initialAssessment.shuffleOptions);
  const [showAnswers, setShowAnswers] = useState(initialAssessment.showAnswersToStudents);
  const [maxAttempts, setMaxAttempts] = useState(String(initialAssessment.maxAttemptsPerStudent));
  const [retakeApproval, setRetakeApproval] = useState(initialAssessment.retakeRequiresApproval);
  const [deliveryMode, setDeliveryMode] = useState(initialAssessment.deliveryMode);
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
  const [questionTab, setQuestionTab] = useState<"build" | "bank">("build");

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
          studentAttemptsLocked,
          shuffleQuestions: shuffle,
          shuffleOptions: shuffleOpts,
          showAnswersToStudents: showAnswers,
          maxAttemptsPerStudent: Math.min(50, Math.max(1, Number(maxAttempts) || 1)),
          retakeRequiresApproval: retakeApproval,
          deliveryMode,
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
    if (isRichTextEmpty(qPrompt)) return;
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
            text: t,
            correct: i === mcqCorrect,
          }))
          .filter((c) => stripHtmlToPlainText(c.text).length > 0);
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
    <div className="mx-auto max-w-6xl space-y-8 px-1 sm:px-0">
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
          <div className="space-y-1 sm:col-span-2">
            <Label>Delivery mode (student experience)</Label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={deliveryMode}
              onChange={(e) =>
                setDeliveryMode(e.target.value as "FORMATIVE" | "SECURE_ONLINE" | "LOCKDOWN")
              }
            >
              <option value="FORMATIVE">Formative — no focus logging or lockdown UI</option>
              <option value="SECURE_ONLINE">
                Secure online — logs tab/window leave; optional fullscreen; visible warnings
              </option>
              <option value="LOCKDOWN">
                High lockdown — same as secure plus no right-click; copy/cut/paste blocked outside answers
              </option>
            </select>
            <p className="text-xs text-muted-foreground">
              Integrity signals are stored for staff review; they do not replace a dedicated lockdown browser or
              invigilation.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={studentAttemptsLocked}
              onChange={(e) => setStudentAttemptsLocked(e.target.checked)}
            />
            Lock new student attempts
          </label>
          <p className="text-xs text-muted-foreground pl-6">
            Blocks starting a fresh attempt. Students with an in-progress draft can still save answers and submit.
          </p>
        </div>
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
        <Link
          href={`${base}/${aid}/item-analysis`}
          className={cn(buttonVariants({ variant: "outline" }), "ml-2 inline-flex")}
        >
          Item analysis
        </Link>
        <Link
          href={`${base}/${aid}/integrity`}
          className={cn(buttonVariants({ variant: "outline" }), "ml-2 inline-flex")}
        >
          Integrity log
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

      <AssessmentScheduleEditor assessmentId={aid} initialEntries={initialScheduleEntries} />

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Questions</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Compose items for this quiz or exam. The take experience uses a clear card layout for students; this
              studio matches that structure where it helps you preview choices and prompts.
            </p>
          </div>
          <Badge variant="secondary" className="h-7 w-fit px-3 text-xs font-medium">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="inline-flex rounded-xl border border-border/80 bg-muted/25 p-1 dark:border-white/10">
          <button
            type="button"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              questionTab === "build"
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/60 dark:ring-white/10"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setQuestionTab("build")}
          >
            Build questions
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              questionTab === "bank"
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/60 dark:ring-white/10"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setQuestionTab("bank")}
          >
            Question bank
          </button>
        </div>

        {questionTab === "bank" ? (
          <AssessmentQuestionBankPanel
            assessmentId={aid}
            disabled={busy}
            onAdded={(q) => {
              setQuestions((prev) => [...prev, q]);
              router.refresh();
            }}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
            <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Outline</h3>
              <ul className="max-h-[min(70vh,560px)] space-y-2 overflow-y-auto pr-1">
                {questions.map((q, i) => (
                  <li
                    key={q.id}
                    className="group rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm transition-colors hover:border-amber-500/35 dark:border-white/10 dark:bg-card/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground dark:bg-white/10">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {questionTypeLabel(q.type)}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{q.points} pts</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-snug text-foreground">
                            {stripHtmlToPlainText(q.prompt) || "—"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        title="Remove question"
                        onClick={() => void removeQuestion(q.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {questions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/10">
                  No questions yet. Use the composer to add your first item.
                </div>
              ) : null}
            </aside>

            <div className="min-w-0 space-y-6">
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm dark:border-white/10">
                <div className="border-b border-border/70 bg-gradient-to-r from-muted/40 via-transparent to-transparent px-5 py-4 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                    <h3 className="font-semibold tracking-tight">Question composer</h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick a type, write the prompt, then complete the fields below. Multiple-choice options mirror the
                    student take layout.
                  </p>
                </div>

                <div className="space-y-6 p-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Question type
                    </Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {BUILDER_TYPE_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const active = qType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setQType(opt.value)}
                            className={cn(
                              "flex flex-col items-start gap-1.5 rounded-xl border px-3 py-3 text-left text-sm transition-all",
                              active
                                ? "border-amber-500/70 bg-amber-500/10 shadow-sm ring-2 ring-amber-500/25 dark:border-amber-400/50 dark:bg-amber-500/15"
                                : "border-border/80 bg-background hover:border-border hover:bg-muted/30 dark:border-white/10",
                            )}
                          >
                            <Icon
                              className={cn("h-4 w-4", active ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground")}
                              aria-hidden
                            />
                            <span className="font-medium leading-tight">{opt.label}</span>
                            <span className="text-[11px] leading-snug text-muted-foreground">{opt.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="-mx-5 border-t border-border/70 px-0 dark:border-white/10">
                    <div className="px-5">
                      <AssessmentFormFieldRow label="Mark" required>
                        <Input
                          id="q-points"
                          className="max-w-[10rem] font-semibold tabular-nums"
                          value={qPoints}
                          onChange={(e) => setQPoints(e.target.value)}
                          inputMode="decimal"
                          aria-label="Marks for this question"
                        />
                      </AssessmentFormFieldRow>
                      <AssessmentFormFieldRow label="Question" required>
                        <AssessmentRichTextField
                          id="q-prompt"
                          value={qPrompt}
                          onChange={setQPrompt}
                          disabled={busy}
                          placeholder="Enter the question. Use the toolbar for formatting and tables; type $inline$ or $$display$$ math anywhere in the text."
                          editorMinHeightClass="min-h-[200px]"
                        />
                      </AssessmentFormFieldRow>
                      <AssessmentFormFieldRow label="Image URL">
                        <Input
                          placeholder="https://… (optional)"
                          value={mediaImageUrl}
                          onChange={(e) => setMediaImageUrl(e.target.value)}
                          disabled={busy}
                        />
                      </AssessmentFormFieldRow>
                      <AssessmentFormFieldRow label="Audio URL">
                        <Input
                          placeholder="https://… (optional)"
                          value={mediaAudioUrl}
                          onChange={(e) => setMediaAudioUrl(e.target.value)}
                          disabled={busy}
                        />
                      </AssessmentFormFieldRow>
                    </div>
                  </div>

                  {qType === "MCQ" ? (
                    <div className="space-y-0 pt-2">
                      <p className="mb-3 text-xs text-muted-foreground">
                        Each option uses the same editor as the question. Select which option is correct.
                      </p>
                      {mcqTexts.map((t, i) => {
                        const isCorrect = mcqCorrect === i;
                        return (
                          <AssessmentFormFieldRow
                            key={i}
                            label={`Option ${i + 1}`}
                            required
                            className={i === mcqTexts.length - 1 ? "border-b-0" : undefined}
                          >
                            <div className="space-y-3">
                              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                                <span
                                  className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                                    isCorrect
                                      ? "border-emerald-600 bg-emerald-500/15 dark:border-emerald-400"
                                      : "border-muted-foreground/35",
                                  )}
                                >
                                  <input
                                    type="radio"
                                    name="mcq-correct"
                                    className="sr-only"
                                    checked={isCorrect}
                                    onChange={() => setMcqCorrect(i)}
                                  />
                                  {isCorrect ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                  ) : null}
                                </span>
                                <span>Correct answer</span>
                              </label>
                              <AssessmentRichTextField
                                value={t}
                                onChange={(html) =>
                                  setMcqTexts((prev) => prev.map((x, j) => (j === i ? html : x)))
                                }
                                disabled={busy}
                                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                editorMinHeightClass="min-h-[120px]"
                                showFooterHint={false}
                              />
                            </div>
                          </AssessmentFormFieldRow>
                        );
                      })}
                    </div>
                  ) : null}
                  {qType === "SHORT_ANSWER" ? (
                    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/10 p-4 dark:border-white/10">
                      <Label>Correct answer (case-insensitive match)</Label>
                      <Input value={shortCorrect} onChange={(e) => setShortCorrect(e.target.value)} />
                    </div>
                  ) : null}
                  {qType === "TRUE_FALSE" ? (
                    <div className="rounded-xl border border-border/70 bg-muted/10 p-4 dark:border-white/10">
                      <label className="flex cursor-pointer items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={tfTrue}
                          onChange={(e) => setTfTrue(e.target.checked)}
                        />
                        <span>Correct answer is <strong>True</strong> (uncheck for False)</span>
                      </label>
                    </div>
                  ) : null}
                  {qType === "LONG_ANSWER" || qType === "ESSAY_RICH" ? (
                    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4 dark:border-white/10">
                      <Label>AI marking scheme helper</Label>
                      <Input
                        placeholder="Topic / focus"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void suggestRubric()}
                      >
                        Suggest rubric (AI or mock)
                      </Button>
                      {aiOut ? (
                        <Textarea readOnly rows={5} value={aiOut} className="text-muted-foreground" />
                      ) : null}
                    </div>
                  ) : null}
                  {qType === "FORMULA" ? (
                    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/10 p-4 dark:border-white/10">
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
                    <div className="space-y-3 rounded-xl border border-dashed border-border/80 bg-muted/10 p-4 dark:border-white/15">
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
                            <span className="min-w-[100px] truncate text-muted-foreground">
                              {label || `Target ${ti + 1}`}
                            </span>
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

                  <Button
                    type="button"
                    size="lg"
                    className="w-full gap-2 sm:w-auto"
                    disabled={busy}
                    onClick={() => void addQuestion()}
                  >
                    <Plus className="h-4 w-4" />
                    Add to assessment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
