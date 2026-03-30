export function submissionTimedOut(startedAt: Date, timeLimitMinutes: number | null): boolean {
  if (timeLimitMinutes == null || timeLimitMinutes <= 0) return false;
  return Date.now() > startedAt.getTime() + timeLimitMinutes * 60_000;
}
