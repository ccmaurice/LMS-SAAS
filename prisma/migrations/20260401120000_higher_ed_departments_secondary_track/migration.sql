-- AlterTable
ALTER TABLE "SchoolCohort" ADD COLUMN "trackLabel" TEXT;

-- CreateTable
CREATE TABLE "FacultyDivision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacultyDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicDepartment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "facultyDivisionId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "chairUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentInstructor" (
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DepartmentInstructor_pkey" PRIMARY KEY ("departmentId","userId")
);

-- CreateTable
CREATE TABLE "StudentDepartmentAffiliation" (
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDepartmentAffiliation_pkey" PRIMARY KEY ("departmentId","userId")
);

-- CreateTable
CREATE TABLE "CourseDepartment" (
    "courseId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "CourseDepartment_pkey" PRIMARY KEY ("courseId","departmentId")
);

-- CreateTable
CREATE TABLE "AssessmentDepartment" (
    "assessmentId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "AssessmentDepartment_pkey" PRIMARY KEY ("assessmentId","departmentId")
);

-- CreateTable
CREATE TABLE "DepartmentMessage" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacultyDivision_organizationId_idx" ON "FacultyDivision"("organizationId");

-- CreateIndex
CREATE INDEX "AcademicDepartment_organizationId_idx" ON "AcademicDepartment"("organizationId");

-- CreateIndex
CREATE INDEX "AcademicDepartment_facultyDivisionId_idx" ON "AcademicDepartment"("facultyDivisionId");

-- CreateIndex
CREATE INDEX "DepartmentInstructor_userId_idx" ON "DepartmentInstructor"("userId");

-- CreateIndex
CREATE INDEX "StudentDepartmentAffiliation_userId_idx" ON "StudentDepartmentAffiliation"("userId");

-- CreateIndex
CREATE INDEX "CourseDepartment_departmentId_idx" ON "CourseDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "AssessmentDepartment_departmentId_idx" ON "AssessmentDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "DepartmentMessage_departmentId_createdAt_idx" ON "DepartmentMessage"("departmentId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "FacultyDivision" ADD CONSTRAINT "FacultyDivision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicDepartment" ADD CONSTRAINT "AcademicDepartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicDepartment" ADD CONSTRAINT "AcademicDepartment_facultyDivisionId_fkey" FOREIGN KEY ("facultyDivisionId") REFERENCES "FacultyDivision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicDepartment" ADD CONSTRAINT "AcademicDepartment_chairUserId_fkey" FOREIGN KEY ("chairUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentInstructor" ADD CONSTRAINT "DepartmentInstructor_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "AcademicDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentInstructor" ADD CONSTRAINT "DepartmentInstructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartmentAffiliation" ADD CONSTRAINT "StudentDepartmentAffiliation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "AcademicDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartmentAffiliation" ADD CONSTRAINT "StudentDepartmentAffiliation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDepartment" ADD CONSTRAINT "CourseDepartment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDepartment" ADD CONSTRAINT "CourseDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "AcademicDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDepartment" ADD CONSTRAINT "AssessmentDepartment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDepartment" ADD CONSTRAINT "AssessmentDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "AcademicDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMessage" ADD CONSTRAINT "DepartmentMessage_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "AcademicDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMessage" ADD CONSTRAINT "DepartmentMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
