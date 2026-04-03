-- CreateEnum
CREATE TYPE "AssessmentScheduleKind" AS ENUM ('CA_OPENS', 'CA_DUE', 'EXAM_WINDOW');

-- CreateTable
CREATE TABLE "AssessmentScheduleEntry" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "kind" "AssessmentScheduleKind" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "label" VARCHAR(200),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentScheduleEntry_assessmentId_idx" ON "AssessmentScheduleEntry"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentScheduleEntry_startsAt_idx" ON "AssessmentScheduleEntry"("startsAt");

-- AddForeignKey
ALTER TABLE "AssessmentScheduleEntry" ADD CONSTRAINT "AssessmentScheduleEntry_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from legacy columns (deterministic ids so re-apply is unlikely to duplicate in dev)
INSERT INTO "AssessmentScheduleEntry" ("id", "assessmentId", "kind", "startsAt", "endsAt", "allDay", "sortOrder", "createdAt", "updatedAt")
SELECT
    'mig_ca_op_' || substr(md5(a.id || 'CA_OPENS'), 1, 20),
    a.id,
    'CA_OPENS'::"AssessmentScheduleKind",
    a."availableFrom",
    NULL,
    false,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Assessment" a
WHERE a."availableFrom" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AssessmentScheduleEntry" e WHERE e."assessmentId" = a.id AND e.kind = 'CA_OPENS'
  );

INSERT INTO "AssessmentScheduleEntry" ("id", "assessmentId", "kind", "startsAt", "endsAt", "allDay", "sortOrder", "createdAt", "updatedAt")
SELECT
    'mig_ca_du_' || substr(md5(a.id || 'CA_DUE'), 1, 20),
    a.id,
    'CA_DUE'::"AssessmentScheduleKind",
    a."dueAt",
    NULL,
    false,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Assessment" a
WHERE a."dueAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AssessmentScheduleEntry" e WHERE e."assessmentId" = a.id AND e.kind = 'CA_DUE'
  );
