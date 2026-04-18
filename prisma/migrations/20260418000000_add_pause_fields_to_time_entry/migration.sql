-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "TimeEntry" ADD COLUMN "accumulatedSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TimeEntry" ADD COLUMN "lastResumeTime" TIMESTAMP(3);
