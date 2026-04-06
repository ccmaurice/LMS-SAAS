-- Staff can excuse integrity signals while keeping an audit trail
ALTER TABLE "ProctoringEvent" ADD COLUMN "dismissedAt" TIMESTAMP(3),
ADD COLUMN "dismissedById" TEXT,
ADD COLUMN "dismissNote" TEXT;

ALTER TABLE "ProctoringEvent" ADD CONSTRAINT "ProctoringEvent_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProctoringEvent_dismissedAt_idx" ON "ProctoringEvent"("dismissedAt");
