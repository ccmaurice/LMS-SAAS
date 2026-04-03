-- CreateEnum
CREATE TYPE "QuestionBankFramework" AS ENUM ('IB', 'CAMBRIDGE', 'AP');

-- CreateTable
CREATE TABLE "QuestionBankItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "framework" "QuestionBankFramework" NOT NULL,
    "subject" TEXT NOT NULL,
    "gradeLabel" TEXT,
    "standardCode" TEXT,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "options" JSONB,
    "correctAnswer" TEXT,
    "markingScheme" TEXT,
    "questionSchema" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBankItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionBankItem_organizationId_idx" ON "QuestionBankItem"("organizationId");

-- CreateIndex
CREATE INDEX "QuestionBankItem_framework_subject_idx" ON "QuestionBankItem"("framework", "subject");

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
