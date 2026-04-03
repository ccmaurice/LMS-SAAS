import type { Question, QuestionType } from "@/generated/prisma/client";
import { gradeAnswer } from "@/lib/assessments/grade";

type QuestionForDisc = Pick<
  Question,
  "id" | "order" | "type" | "prompt" | "points" | "options" | "correctAnswer" | "questionSchema"
>;

export type SubmissionForDiscrimination = {
  id: string;
  totalScore: number | null;
  maxScore: number | null;
  answers: { questionId: string; content: string }[];
};

export type DiscriminationRow = {
  questionId: string;
  order: number;
  promptPreview: string;
  type: QuestionType;
  /** Proportion correct among all submissions with a gradable answer (facility / classical p). */
  pOverall: number | null;
  /** Pearson r between item correct (0/1) and total score % — point-biserial with continuous total. */
  pointBiserial: number | null;
  /** Proportion correct in bottom ~27% by total score. */
  pLow: number | null;
  /** Proportion correct in top ~27% by total score. */
  pHigh: number | null;
  /** Classic high–low index: pHigh − pLow (−1…1). */
  dIndex: number | null;
  nLow: number;
  nHigh: number;
  /** Submissions with a gradable answer for this item. */
  nGraded: number;
  note: string | null;
};

const OBJECTIVE: QuestionType[] = ["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "FORMULA", "DRAG_DROP"];

function previewPrompt(prompt: string, max = 72): string {
  const t = prompt.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function submissionPercent(sub: SubmissionForDiscrimination): number | null {
  if (sub.maxScore == null || sub.maxScore <= 0) return null;
  return ((sub.totalScore ?? 0) / sub.maxScore) * 100;
}

function binaryCorrect(q: QuestionForDisc, content: string): boolean | null {
  const g = gradeAnswer(q, content);
  if (!g.autoGraded) return null;
  return g.score >= q.points - 1e-6;
}

/** Pearson r between binary x ∈ {0,1} and continuous y; equals point-biserial when x is dichotomous. */
export function pearsonBinaryVsContinuous(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n !== ys.length || n < 5) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  if (meanX <= 1e-9 || meanX >= 1 - 1e-9) return null;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (n < 2) return null;
  const sx = Math.sqrt(vx / (n - 1));
  const sy = Math.sqrt(vy / (n - 1));
  if (sx < 1e-12 || sy < 1e-12) return null;
  return (cov / (n - 1)) / (sx * sy);
}

function objectiveOverallAndPointBiserial(
  q: QuestionForDisc,
  submissions: SubmissionForDiscrimination[],
): { pOverall: number | null; pointBiserial: number | null; nGraded: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  let correct = 0;
  let nGraded = 0;

  for (const sub of submissions) {
    const ans = sub.answers.find((a) => a.questionId === q.id);
    if (!ans) continue;
    const bc = binaryCorrect(q, ans.content);
    if (bc === null) continue;
    nGraded += 1;
    if (bc) correct += 1;
    const pct = submissionPercent(sub);
    if (pct != null) {
      xs.push(bc ? 1 : 0);
      ys.push(pct);
    }
  }

  const pOverall = nGraded > 0 ? correct / nGraded : null;
  const pointBiserial = xs.length >= 5 ? pearsonBinaryVsContinuous(xs, ys) : null;

  return { pOverall, pointBiserial, nGraded };
}

export function computeHighLow27Groups(
  subs: SubmissionForDiscrimination[],
): { lowIds: Set<string>; highIds: Set<string>; k: number } | null {
  const scored = subs
    .map((s) => ({ s, pct: submissionPercent(s) }))
    .filter((x): x is { s: SubmissionForDiscrimination; pct: number } => x.pct != null);
  const n = scored.length;
  if (n < 4) return null;
  scored.sort((a, b) => a.pct - b.pct);
  const k = Math.max(1, Math.min(Math.floor(n * 0.27), Math.floor(n / 2)));
  const lowIds = new Set(scored.slice(0, k).map((x) => x.s.id));
  const highIds = new Set(scored.slice(n - k).map((x) => x.s.id));
  return { lowIds, highIds, k };
}

function emptyObjectiveRow(
  q: QuestionForDisc,
  promptPreview: string,
  note: string | null,
  submissions: SubmissionForDiscrimination[],
): DiscriminationRow {
  const { pOverall, pointBiserial, nGraded } = OBJECTIVE.includes(q.type)
    ? objectiveOverallAndPointBiserial(q, submissions)
    : { pOverall: null, pointBiserial: null, nGraded: 0 };

  return {
    questionId: q.id,
    order: q.order,
    promptPreview,
    type: q.type,
    pOverall,
    pointBiserial,
    pLow: null,
    pHigh: null,
    dIndex: null,
    nLow: 0,
    nHigh: 0,
    nGraded,
    note,
  };
}

export function computeItemDiscrimination27(
  questions: QuestionForDisc[],
  submissions: SubmissionForDiscrimination[],
): DiscriminationRow[] {
  const groups = computeHighLow27Groups(submissions);
  const ordered = [...questions].sort((a, b) => a.order - b.order);

  if (!groups) {
    return ordered.map((q) => {
      const promptPreview = previewPrompt(q.prompt);
      if (!OBJECTIVE.includes(q.type)) {
        return emptyObjectiveRow(q, promptPreview, "Manual or non-auto types omitted.", submissions);
      }
      const base = objectiveOverallAndPointBiserial(q, submissions);
      return {
        questionId: q.id,
        order: q.order,
        promptPreview,
        type: q.type,
        pOverall: base.pOverall,
        pointBiserial: base.pointBiserial,
        pLow: null,
        pHigh: null,
        dIndex: null,
        nLow: 0,
        nHigh: 0,
        nGraded: base.nGraded,
        note: "Need at least four scored submissions for 27% high/low groups.",
      };
    });
  }

  return ordered.map((q) => {
    const promptPreview = previewPrompt(q.prompt);
    if (!OBJECTIVE.includes(q.type)) {
      return emptyObjectiveRow(q, promptPreview, "Manual or non-auto types omitted.", submissions);
    }

    const { pOverall, pointBiserial, nGraded } = objectiveOverallAndPointBiserial(q, submissions);

    let correctLow = 0;
    let nLow = 0;
    let correctHigh = 0;
    let nHigh = 0;

    for (const sub of submissions) {
      const ans = sub.answers.find((a) => a.questionId === q.id);
      if (!ans) continue;
      const bc = binaryCorrect(q, ans.content);
      if (bc === null) continue;

      if (groups.lowIds.has(sub.id)) {
        nLow += 1;
        if (bc) correctLow += 1;
      }
      if (groups.highIds.has(sub.id)) {
        nHigh += 1;
        if (bc) correctHigh += 1;
      }
    }

    const pLow = nLow > 0 ? correctLow / nLow : null;
    const pHigh = nHigh > 0 ? correctHigh / nHigh : null;
    const dIndex = pLow != null && pHigh != null ? pHigh - pLow : null;

    let note: string | null = null;
    if (nLow === 0 || nHigh === 0) {
      note = "Too few graded answers in one score tail.";
    }

    return {
      questionId: q.id,
      order: q.order,
      promptPreview,
      type: q.type,
      pOverall,
      pointBiserial,
      pLow,
      pHigh,
      dIndex,
      nLow,
      nHigh,
      nGraded,
      note,
    };
  });
}
