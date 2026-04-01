-- Universal Education Platform: org context, grading extensions, pools, parent/competency, proctoring, moderation audit

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('PRIMARY', 'SECONDARY', 'HIGHER_ED');

-- CreateEnum
CREATE TYPE "SubmissionModerationState" AS ENUM ('NONE', 'FIRST_REVIEW', 'SECOND_REVIEW', 'EXTERNAL_REVIEW', 'APPROVED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PARENT';

-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'DRAG_DROP';
ALTER TYPE "QuestionType" ADD VALUE 'ESSAY_RICH';
ALTER TYPE "QuestionType" ADD VALUE 'FORMULA';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "educationLevel" "EducationLevel" NOT NULL DEFAULT 'SECONDARY';
ALTER TABLE "Organization" ADD COLUMN "organizationSettings" JSONB;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "creditHours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN "shuffleOptions" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "rubric" JSONB;
ALTER TABLE "Question" ADD COLUMN "questionSchema" JSONB;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "moderationState" "SubmissionModerationState" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN "rubricScores" JSONB;
ALTER TABLE "Answer" ADD COLUMN "annotations" JSONB;

-- CreateTable
CREATE TABLE "AssessmentQuestionPool" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Pool',
    "drawCount" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssessmentQuestionPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentPoolEntry" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,

    CONSTRAINT "AssessmentPoolEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentStudentLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentStudentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningStandard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "LearningStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionStandard" (
    "questionId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,

    CONSTRAINT "QuestionStandard_pkey" PRIMARY KEY ("questionId","standardId")
);

-- CreateTable
CREATE TABLE "ProctoringEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "submissionId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProctoringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentQuestionPool_assessmentId_idx" ON "AssessmentQuestionPool"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPoolEntry_poolId_questionId_key" ON "AssessmentPoolEntry"("poolId", "questionId");

-- CreateIndex
CREATE INDEX "AssessmentPoolEntry_questionId_idx" ON "AssessmentPoolEntry"("questionId");

-- CreateIndex
CREATE INDEX "ParentStudentLink_parentUserId_idx" ON "ParentStudentLink"("parentUserId");

-- CreateIndex
CREATE INDEX "ParentStudentLink_studentUserId_idx" ON "ParentStudentLink"("studentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudentLink_organizationId_parentUserId_studentUserId_key" ON "ParentStudentLink"("organizationId", "parentUserId", "studentUserId");

-- CreateIndex
CREATE INDEX "LearningStandard_organizationId_idx" ON "LearningStandard"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningStandard_organizationId_code_key" ON "LearningStandard"("organizationId", "code");

-- CreateIndex
CREATE INDEX "QuestionStandard_standardId_idx" ON "QuestionStandard"("standardId");

-- CreateIndex
CREATE INDEX "ProctoringEvent_organizationId_createdAt_idx" ON "ProctoringEvent"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProctoringEvent_userId_idx" ON "ProctoringEvent"("userId");

-- CreateIndex
CREATE INDEX "GradingAuditLog_entityId_idx" ON "GradingAuditLog"("entityId");

-- CreateIndex
CREATE INDEX "GradingAuditLog_organizationId_createdAt_idx" ON "GradingAuditLog"("organizationId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AssessmentQuestionPool" ADD CONSTRAINT "AssessmentQuestionPool_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPoolEntry" ADD CONSTRAINT "AssessmentPoolEntry_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "AssessmentQuestionPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPoolEntry" ADD CONSTRAINT "AssessmentPoolEntry_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningStandard" ADD CONSTRAINT "LearningStandard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionStandard" ADD CONSTRAINT "QuestionStandard_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionStandard" ADD CONSTRAINT "QuestionStandard_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "LearningStandard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringEvent" ADD CONSTRAINT "ProctoringEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringEvent" ADD CONSTRAINT "ProctoringEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingAuditLog" ADD CONSTRAINT "GradingAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingAuditLog" ADD CONSTRAINT "GradingAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
