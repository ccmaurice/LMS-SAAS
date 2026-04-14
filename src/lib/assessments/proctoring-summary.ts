export type ProctorEventAgg = { eventType: string; count: number };

const EVENT_LABELS: Record<string, string> = {
  window_blur: "window blur",
  document_hidden: "tab hidden",
  fullscreen_exit: "left fullscreen",
};

const EVENT_I18N_KEYS: Record<string, string> = {
  window_blur: "assessments.proctor.windowBlur",
  document_hidden: "assessments.proctor.documentHidden",
  fullscreen_exit: "assessments.proctor.fullscreenExit",
};

/** Optional `t` from `getServerT()` / `useI18n()` for localized known event types. */
export function proctorEventTypeLabel(eventType: string, t?: (key: string) => string): string {
  if (t) {
    const k = EVENT_I18N_KEYS[eventType];
    if (k) {
      const msg = t(k);
      if (msg !== k) return msg;
    }
  }
  return EVENT_LABELS[eventType] ?? eventType.replace(/_/g, " ");
}

/** Groups proctor rows by submission for gradebook summaries. */
export function aggregateProctorEventsBySubmission(
  events: { submissionId: string | null; eventType: string }[],
): Record<string, ProctorEventAgg[]> {
  const bySubmission = new Map<string, Map<string, number>>();

  for (const e of events) {
    if (!e.submissionId) continue;
    let types = bySubmission.get(e.submissionId);
    if (!types) {
      types = new Map();
      bySubmission.set(e.submissionId, types);
    }
    types.set(e.eventType, (types.get(e.eventType) ?? 0) + 1);
  }

  const out: Record<string, ProctorEventAgg[]> = {};
  for (const [sid, map] of bySubmission) {
    out[sid] = [...map.entries()]
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => a.eventType.localeCompare(b.eventType));
  }
  return out;
}

export function formatProctorSummaryLine(aggs: ProctorEventAgg[], t?: (key: string) => string): string {
  if (aggs.length === 0) return "";
  return aggs.map((a) => `${a.count}× ${proctorEventTypeLabel(a.eventType, t)}`).join(" · ");
}
