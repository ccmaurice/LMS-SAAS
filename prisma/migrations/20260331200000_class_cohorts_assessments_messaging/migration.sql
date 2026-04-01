-- CreateTable
CREATE TABLE "CohortInstructor" (
    "cohortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CohortInstructor_pkey" PRIMARY KEY ("cohortId","userId")
);

-- CreateTable
CREATE TABLE "CourseCohort" (
    "courseId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,

    CONSTRAINT "CourseCohort_pkey" PRIMARY KEY ("courseId","cohortId")
);

-- CreateTable
CREATE TABLE "AssessmentCohort" (
    "assessmentId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,

    CONSTRAINT "AssessmentCohort_pkey" PRIMARY KEY ("assessmentId","cohortId")
);

-- CreateTable
CREATE TABLE "CohortMessage" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CohortInstructor_userId_idx" ON "CohortInstructor"("userId");

-- CreateIndex
CREATE INDEX "CourseCohort_cohortId_idx" ON "CourseCohort"("cohortId");

-- CreateIndex
CREATE INDEX "AssessmentCohort_cohortId_idx" ON "AssessmentCohort"("cohortId");

-- CreateIndex
CREATE INDEX "CohortMessage_cohortId_createdAt_idx" ON "CohortMessage"("cohortId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "CohortInstructor" ADD CONSTRAINT "CohortInstructor_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "SchoolCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortInstructor" ADD CONSTRAINT "CohortInstructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCohort" ADD CONSTRAINT "CourseCohort_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCohort" ADD CONSTRAINT "CourseCohort_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "SchoolCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCohort" ADD CONSTRAINT "AssessmentCohort_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCohort" ADD CONSTRAINT "AssessmentCohort_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "SchoolCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMessage" ADD CONSTRAINT "CohortMessage_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "SchoolCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMessage" ADD CONSTRAINT "CohortMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill homeroom teachers as cohort instructors
INSERT INTO "CohortInstructor" ("cohortId", "userId")
SELECT "id", "homeroomTeacherId" FROM "SchoolCohort" WHERE "homeroomTeacherId" IS NOT NULL
ON CONFLICT DO NOTHING;
