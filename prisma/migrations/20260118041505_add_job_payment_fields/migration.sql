-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "calculatedAmount" DOUBLE PRECISION,
ADD COLUMN     "jobNumber" TEXT,
ADD COLUMN     "paidAmount" DOUBLE PRECISION;
