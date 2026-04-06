-- Speed integrity log / export queries filtered by assessment
CREATE INDEX IF NOT EXISTS "ProctoringEvent_assessmentId_idx" ON "ProctoringEvent"("assessmentId");
