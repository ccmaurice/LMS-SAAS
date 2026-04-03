export type TranscriptTermScope =
  | { kind: "all" }
  | { kind: "single"; termId: string }
  | { kind: "range"; fromTermId: string; toTermId: string };

/** Lower-case calendar period words (e.g. term/terms or semester/semesters). */
export type TranscriptScopePeriodLabels = { singular: string; plural: string };

function capitalizeWord(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const DEFAULT_SCOPE_PERIOD_LABELS: TranscriptScopePeriodLabels = { singular: "term", plural: "terms" };

export function transcriptScopeDescription(
  scope: TranscriptTermScope,
  terms: { id: string; label: string }[],
  period: TranscriptScopePeriodLabels = DEFAULT_SCOPE_PERIOD_LABELS,
): string | null {
  const byId = new Map(terms.map((t) => [t.id, t.label]));
  const S = capitalizeWord(period.singular);
  const P = capitalizeWord(period.plural);
  if (scope.kind === "all") return null;
  if (scope.kind === "single") {
    const lb = byId.get(scope.termId);
    return lb ? `${S}: ${lb}` : `${S} filter`;
  }
  const a = byId.get(scope.fromTermId);
  const b = byId.get(scope.toTermId);
  if (a && b) {
    if (scope.fromTermId === scope.toTermId) return `${S}: ${a}`;
    return `${P}: ${a} — ${b}`;
  }
  if (scope.fromTermId === scope.toTermId && a) return `${S}: ${a}`;
  return `${S} range`;
}

export function transcriptScopeQueryPairs(scope: TranscriptTermScope): [string, string][] {
  if (scope.kind === "all") return [];
  if (scope.kind === "single") return [["term", scope.termId]];
  return [
    ["fromTerm", scope.fromTermId],
    ["toTerm", scope.toTermId],
  ];
}

/** Full query string for `/api/me/transcript-pdf` including optional parent `child`. */
export function buildTranscriptPdfQuery(opts: { child?: string; scope: TranscriptTermScope }): string {
  const p = new URLSearchParams();
  if (opts.child) p.set("child", opts.child);
  if (opts.scope.kind === "single") p.set("term", opts.scope.termId);
  else if (opts.scope.kind === "range") {
    p.set("fromTerm", opts.scope.fromTermId);
    p.set("toTerm", opts.scope.toTermId);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
