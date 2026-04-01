-- CreateEnum
CREATE TYPE "RetakeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN "showAnswersToStudents" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Assessment" ADD COLUMN "maxAttemptsPerStudent" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Assessment" ADD COLUMN "retakeRequiresApproval" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AssessmentRetakeRequest" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromSubmissionId" TEXT,
    "status" "RetakeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "studentNote" TEXT,
    "staffNote" TEXT,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentRetakeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentRetakeRequest_assessmentId_status_idx" ON "AssessmentRetakeRequest"("assessmentId", "status");

-- CreateIndex
CREATE INDEX "AssessmentRetakeRequest_userId_assessmentId_idx" ON "AssessmentRetakeRequest"("userId", "assessmentId");

-- AddForeignKey
ALTER TABLE "AssessmentRetakeRequest" ADD CONSTRAINT "AssessmentRetakeRequest_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRetakeRequest" ADD CONSTRAINT "AssessmentRetakeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRetakeRequest" ADD CONSTRAINT "AssessmentRetakeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRetakeRequest" ADD CONSTRAINT "AssessmentRetakeRequest_fromSubmissionId_fkey" FOREIGN KEY ("fromSubmissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
