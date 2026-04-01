import type { Question } from "@/generated/prisma/client";

export type PoolEntryWithQuestion = {
  questionId: string;
  question: Question;
};

export type QuestionPoolModel = {
  id: string;
  drawCount: number;
  sortOrder: number;
  entries: PoolEntryWithQuestion[];
};

/**
 * Questions tagged only in pools are delivered via random draw; questions not in any pool stay fixed.
 */
export function resolveQuestionsForStudentTake(args: {
  directQuestions: Question[];
  pools: QuestionPoolModel[];
}): Question[] {
  const inPool = new Set<string>();
  for (const p of args.pools) {
    for (const e of p.entries) inPool.add(e.questionId);
  }
  const base = args.directQuestions.filter((q) => !inPool.has(q.id));
  const pooled: Question[] = [];
  const sortedPools = [...args.pools].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  for (const pool of sortedPools) {
    if (pool.entries.length === 0) continue;
    const shuffled = [...pool.entries].sort(() => Math.random() - 0.5);
    const n = Math.min(Math.max(0, pool.drawCount), shuffled.length);
    for (let i = 0; i < n; i++) pooled.push(shuffled[i].question);
  }
  return [...base, ...pooled];
}
