import { prisma } from "@/lib/db";
import type { TranscriptTermScope } from "@/lib/transcript/academic-term-scope.shared";

export type { TranscriptTermScope } from "@/lib/transcript/academic-term-scope.shared";
export {
  buildTranscriptPdfQuery,
  transcriptScopeDescription,
  transcriptScopeQueryPairs,
} from "@/lib/transcript/academic-term-scope.shared";

/** Ordered timeline for session / term range filters (startDate → sortOrder → label). */
export async function listAcademicTermsOrdered(organizationId: string) {
  const terms = await prisma.academicTerm.findMany({
    where: { organizationId },
    select: { id: true, code: true, label: true, startDate: true, sortOrder: true },
  });
  terms.sort((a, b) => {
    const ta = a.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const tb = b.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label);
  });
  return terms;
}

/**
 * Course `academicTermId` must be in this set. Courses with no term are excluded whenever
 * the scope is not `all` (they still appear on the full transcript).
 */
export async function resolveTranscriptTermIds(
  organizationId: string,
  scope: TranscriptTermScope,
): Promise<Set<string> | null> {
  if (scope.kind === "all") return null;

  const ordered = await listAcademicTermsOrdered(organizationId);
  const idSet = new Set(ordered.map((t) => t.id));

  if (scope.kind === "single") {
    if (!idSet.has(scope.termId)) return new Set();
    return new Set([scope.termId]);
  }

  const { fromTermId, toTermId } = scope;
  if (!idSet.has(fromTermId) || !idSet.has(toTermId)) return new Set();

  let i = ordered.findIndex((t) => t.id === fromTermId);
  let j = ordered.findIndex((t) => t.id === toTermId);
  if (i === -1 || j === -1) return new Set();
  if (i > j) [i, j] = [j, i];

  return new Set(ordered.slice(i, j + 1).map((t) => t.id));
}

export async function transcriptScopeFromSearchParams(
  organizationId: string,
  sp: { term?: string; fromTerm?: string; toTerm?: string },
): Promise<TranscriptTermScope> {
  const single = sp.term?.trim();
  if (single) return { kind: "single", termId: single };

  const from = sp.fromTerm?.trim();
  const to = sp.toTerm?.trim();
  if (!from && !to) return { kind: "all" };

  const ordered = await listAcademicTermsOrdered(organizationId);
  if (ordered.length === 0) return { kind: "all" };

  const firstId = ordered[0]!.id;
  const lastId = ordered[ordered.length - 1]!.id;

  if (from && to) return { kind: "range", fromTermId: from, toTermId: to };
  if (from) return { kind: "range", fromTermId: from, toTermId: lastId };
  return { kind: "range", fromTermId: firstId, toTermId: to! };
}
