-- AlterTable
ALTER TABLE "LearningResource" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "LearningResource_organizationId_createdById_idx" ON "LearningResource"("organizationId", "createdById");

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
