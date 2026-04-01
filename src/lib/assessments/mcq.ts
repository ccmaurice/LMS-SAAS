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

/** Fisher–Yates shuffle of choice order for delivery (correct flags already stripped). */
export function shuffleMcqForStudent(raw: unknown): McqOptions | null {
  const s = sanitizeMcqForStudent(raw);
  if (!s) return null;
  const choices = [...s.choices];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { choices };
}
