-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "autoSendReport" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReportDelivery" ADD COLUMN     "automatic" BOOLEAN NOT NULL DEFAULT false;

