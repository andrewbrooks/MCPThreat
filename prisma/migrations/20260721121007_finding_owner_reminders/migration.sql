-- AlterTable
ALTER TABLE "Finding" ADD COLUMN "lastAlertAt" DATETIME;
ALTER TABLE "Finding" ADD COLUMN "reminderIntervalDays" INTEGER;
ALTER TABLE "Finding" ADD COLUMN "reminderNextAt" DATETIME;
