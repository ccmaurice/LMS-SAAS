-- CreateEnum
CREATE TYPE "AssessmentDeliveryMode" AS ENUM ('FORMATIVE', 'SECURE_ONLINE', 'LOCKDOWN');

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN "deliveryMode" "AssessmentDeliveryMode" NOT NULL DEFAULT 'FORMATIVE';
