-- CreateEnum
CREATE TYPE "SchoolCalendarEventKind" AS ENUM ('RESUMPTION', 'CLOSURE', 'HOLIDAY', 'EVENT', 'ACTIVITY', 'OTHER');

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "dueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SchoolCalendarEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "SchoolCalendarEventKind" NOT NULL DEFAULT 'EVENT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarNotificationDedupe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarNotificationDedupe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolCalendarEvent_organizationId_startsAt_idx" ON "SchoolCalendarEvent"("organizationId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarNotificationDedupe_userId_idx" ON "CalendarNotificationDedupe"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarNotificationDedupe_userId_dedupeKey_key" ON "CalendarNotificationDedupe"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "SchoolCalendarEvent" ADD CONSTRAINT "SchoolCalendarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCalendarEvent" ADD CONSTRAINT "SchoolCalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarNotificationDedupe" ADD CONSTRAINT "CalendarNotificationDedupe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Assessment calendar indexes (optional filters)
CREATE INDEX "Assessment_dueAt_idx" ON "Assessment"("dueAt");
CREATE INDEX "Assessment_availableFrom_idx" ON "Assessment"("availableFrom");
