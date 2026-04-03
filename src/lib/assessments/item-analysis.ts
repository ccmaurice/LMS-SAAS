import type { Question, QuestionType } from "@/generated/prisma/client";
import { parseDragDropFromQuestionSchema } from "@/lib/assessments/drag-drop-schema";
import { effectiveAnswerScore } from "@/lib/assessments/grade";
import { parseMcqOptions } from "@/lib/assessments/mcq";

export type ItemAnalysisContext = {
  /** Question IDs that appear in at least one pool (may not be seen by every student). */
  pooledQuestionIds: ReadonlySet<string>;
  /** Assessment has at least one pool with entries. */
  assessmentUsesPools: boolean;
};

export type ItemAnalysisRow = {
  questionId: string;
  order: number;
  type: QuestionType;
  promptPreview: string;
  maxPoints: number;
  responseCount: number;
  meanPercent: number | null;
  fullCreditPercent: number | null;
  note: string | null;
  /** Human-readable lines (MCQ option %, TF split, drag-drop slot match %). */
  distributionLines: string[] | null;
};

type QuestionForAnalysis = Pick<
  Question,
  "id" | "order" | "type" | "prompt" | "points" | "options" | "correctAnswer" | "questionSchema"
>;

type AnswerForAnalysis = {
  questionId: string;
  content: string;
  score: number | null;
  manualScore: number | null;
};

function previewPrompt(prompt: string, max = 96): string {
  const t = prompt.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function previewText(s: string, max = 32): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

const OBJECTIVE_TYPES: QuestionType[] = ["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "FORMULA", "DRAG_DROP"];

function parseMcqChoiceId(content: string): string | null {
  try {
    const j = JSON.parse(content) as { choiceId?: string; id?: string };
    const id = j.choiceId ?? j.id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

function computeMcqDistribution(q: QuestionForAnalysis, answers: AnswerForAnalysis[], n: number): string[] | null {
  const opts = parseMcqOptions(q.options);
  if (!opts) return null;
  const counts = new Map<string, number>();
  for (const c of opts.choices) counts.set(c.id, 0);
  let invalid = 0;
  for (const a of answers) {
    const id = parseMcqChoiceId(a.content);
    if (id == null || !counts.has(id)) {
      invalid += 1;
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const lines: string[] = [];
  for (const c of opts.choices) {
    const cnt = counts.get(c.id) ?? 0;
    const pct = n > 0 ? (cnt / n) * 100 : 0;
    const key = c.correct ? " (key)" : "";
    lines.push(`${previewText(c.text)}: ${pct.toFixed(1)}% (${cnt})${key}`);
  }
  if (invalid > 0) {
    lines.push(`Invalid / blank: ${((invalid / n) * 100).toFixed(1)}% (${invalid})`);
  }
  return lines;
}

function computeTrueFalseDistribution(answers: AnswerForAnalysis[], n: number): string[] | null {
  let trueC = 0;
  let falseC = 0;
  let invalid = 0;
  for (const a of answers) {
    try {
      const j = JSON.parse(a.content) as { value?: boolean };
      if (j.value === true) trueC += 1;
      else if (j.value === false) falseC += 1;
      else invalid += 1;
    } catch {
      invalid += 1;
    }
  }
  return [
    `True: ${n > 0 ? ((trueC / n) * 100).toFixed(1) : "0.0"}% (${trueC})`,
    `False: ${n > 0 ? ((falseC / n) * 100).toFixed(1) : "0.0"}% (${falseC})`,
    ...(invalid > 0 ? [`Invalid: ${((invalid / n) * 100).toFixed(1)}% (${invalid})`] : []),
  ];
}

function computeDragDropSlotRates(q: QuestionForAnalysis, answers: AnswerForAnalysis[], n: number): string[] | null {
  const dd = parseDragDropFromQuestionSchema(q.questionSchema);
  const correct = dd?.correct;
  if (!dd || !correct || Object.keys(correct).length === 0) return null;
  const labelByTarget = new Map(dd.targets.map((t) => [t.id, t.label]));
  const hits = new Map<string, number>();
  for (const k of Object.keys(correct)) hits.set(k, 0);

  for (const a of answers) {
    let assignments: Record<string, string> = {};
    try {
      const j = JSON.parse(a.content) as { assignments?: Record<string, string> };
      if (j.assignments && typeof j.assignments === "object") assignments = j.assignments;
    } catch {
      continue;
    }
    for (const targetId of Object.keys(correct)) {
      if (assignments[targetId] === correct[targetId]) {
        hits.set(targetId, (hits.get(targetId) ?? 0) + 1);
      }
    }
  }

  const lines: string[] = [];
  for (const targetId of Object.keys(correct)) {
    const h = hits.get(targetId) ?? 0;
    const pct = n > 0 ? (h / n) * 100 : 0;
    const lab = labelByTarget.get(targetId) ?? targetId;
    lines.push(`${previewText(lab)}: ${pct.toFixed(1)}% correct (${h}/${n})`);
  }
  return lines;
}

export function formatDistributionForTsv(lines: string[] | null): string {
  if (!lines?.length) return "";
  return lines.map((l) => l.replace(/\t/g, " ")).join(" · ");
}

export function computeItemAnalysis(
  questions: QuestionForAnalysis[],
  submittedAnswersBySubmission: { answers: AnswerForAnalysis[] }[],
  context?: ItemAnalysisContext,
): ItemAnalysisRow[] {
  const ordered = [...questions].sort((a, b) => a.order - b.order);

  return ordered.map((q) => {
    const answers = submittedAnswersBySubmission.flatMap((s) =>
      s.answers.filter((a) => a.questionId === q.id),
    );
    const n = answers.length;

    if (n === 0) {
      let note: string | null = "No answers on submitted attempts.";
      if (context?.pooledQuestionIds.has(q.id)) {
        note = "No responses yet. Pool item — not all students receive this question.";
      }
      return {
        questionId: q.id,
        order: q.order,
        type: q.type,
        promptPreview: previewPrompt(q.prompt),
        maxPoints: q.points,
        responseCount: 0,
        meanPercent: null,
        fullCreditPercent: null,
        note,
        distributionLines: null,
      };
    }

    let sumPercent = 0;
    let fullCredit = 0;
    const maxPts = q.points > 0 ? q.points : 1;

    for (const a of answers) {
      const eff = effectiveAnswerScore(a, q.points);
      sumPercent += maxPts > 0 ? (eff / maxPts) * 100 : 0;
      if (eff >= q.points - 1e-6) fullCredit += 1;
    }

    const meanPercent = sumPercent / n;
    const fullCreditPercent = (fullCredit / n) * 100;

    let note: string | null = null;
    if (q.type === "LONG_ANSWER" || q.type === "ESSAY_RICH") {
      note = "Open response; % reflects manual (or AI) scores recorded on each answer.";
    }
    if (context?.pooledQuestionIds.has(q.id)) {
      const poolNote = "Pool item — not all students received this question.";
      note = note ? `${note} ${poolNote}` : poolNote;
    }

    let distributionLines: string[] | null = null;
    if (q.type === "MCQ") distributionLines = computeMcqDistribution(q, answers, n);
    else if (q.type === "TRUE_FALSE") distributionLines = computeTrueFalseDistribution(answers, n);
    else if (q.type === "DRAG_DROP") distributionLines = computeDragDropSlotRates(q, answers, n);

    return {
      questionId: q.id,
      order: q.order,
      type: q.type,
      promptPreview: previewPrompt(q.prompt),
      maxPoints: q.points,
      responseCount: n,
      meanPercent,
      fullCreditPercent: OBJECTIVE_TYPES.includes(q.type) ? fullCreditPercent : null,
      note,
      distributionLines,
    };
  });
}
