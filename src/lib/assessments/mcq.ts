export type McqChoice = { id: string; text: string; correct?: boolean };

export type McqOptions = { choices: McqChoice[] };

export function parseMcqOptions(raw: unknown): McqOptions | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { choices?: unknown };
  if (!Array.isArray(o.choices)) return null;
  const choices: McqChoice[] = [];
  for (const c of o.choices) {
    if (!c || typeof c !== "object") continue;
    const x = c as { id?: unknown; text?: unknown; correct?: unknown };
    if (typeof x.id !== "string" || typeof x.text !== "string") continue;
    choices.push({ id: x.id, text: x.text, correct: Boolean(x.correct) });
  }
  if (choices.length === 0) return null;
  return { choices };
}

export function sanitizeMcqForStudent(raw: unknown): McqOptions | null {
  const parsed = parseMcqOptions(raw);
  if (!parsed) return null;
  return {
    choices: parsed.choices.map(({ id, text }) => ({ id, text })),
  };
}
