/** Deterministic pair so each org has at most one thread per user pair. */
export function orderedParticipantIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function otherParticipantId(thread: { participantLowId: string; participantHighId: string }, me: string): string {
  return thread.participantLowId === me ? thread.participantHighId : thread.participantLowId;
}
