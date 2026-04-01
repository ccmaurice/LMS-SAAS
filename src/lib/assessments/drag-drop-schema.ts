export type DragDropTarget = { id: string; label: string };
export type DragDropBankItem = { id: string; text: string };

export type DragDropSchema = {
  targets: DragDropTarget[];
  bank: DragDropBankItem[];
  correct?: Record<string, string>;
};

export function parseDragDropFromQuestionSchema(
  questionSchema: unknown | null | undefined,
): DragDropSchema | null {
  if (questionSchema == null || typeof questionSchema !== "object" || Array.isArray(questionSchema)) return null;
  const root = questionSchema as Record<string, unknown>;
  const raw = root.dragDrop;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const dd = raw as Record<string, unknown>;
  const targets = dd.targets;
  const bank = dd.bank;
  if (!Array.isArray(targets) || !Array.isArray(bank)) return null;
  const normTargets: DragDropTarget[] = [];
  for (const t of targets) {
    if (t == null || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const label = typeof o.label === "string" ? o.label : "";
    if (id && label) normTargets.push({ id, label });
  }
  const normBank: DragDropBankItem[] = [];
  for (const b of bank) {
    if (b == null || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const text = typeof o.text === "string" ? o.text : "";
    if (id && text) normBank.push({ id, text });
  }
  if (normTargets.length === 0 || normBank.length === 0) return null;
  let correct: Record<string, string> | undefined;
  if (dd.correct != null && typeof dd.correct === "object" && !Array.isArray(dd.correct)) {
    correct = {};
    for (const [k, v] of Object.entries(dd.correct as Record<string, unknown>)) {
      if (typeof v === "string") correct[k] = v;
    }
  }
  return { targets: normTargets, bank: normBank, correct };
}

/** Student-safe copy: drops `correct` from dragDrop. */
export function stripDragDropCorrectForStudent(questionSchema: unknown | null | undefined): unknown {
  if (questionSchema == null || typeof questionSchema !== "object" || Array.isArray(questionSchema)) {
    return questionSchema ?? null;
  }
  const root = { ...(questionSchema as Record<string, unknown>) };
  const raw = root.dragDrop;
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    const dd = { ...(raw as Record<string, unknown>) };
    delete dd.correct;
    root.dragDrop = dd;
  }
  return root;
}
