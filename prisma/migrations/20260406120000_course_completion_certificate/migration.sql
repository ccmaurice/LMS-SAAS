-- CreateTable
CREATE TABLE "CourseCompletionCertificate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseCompletionCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseCompletionCertificate_userId_courseId_key" ON "CourseCompletionCertificate"("userId", "courseId");

-- CreateIndex
CREATE INDEX "CourseCompletionCertificate_organizationId_idx" ON "CourseCompletionCertificate"("organizationId");

-- AddForeignKey
ALTER TABLE "CourseCompletionCertificate" ADD CONSTRAINT "CourseCompletionCertificate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCompletionCertificate" ADD CONSTRAINT "CourseCompletionCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCompletionCertificate" ADD CONSTRAINT "CourseCompletionCertificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
