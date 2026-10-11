-- AlterTable
ALTER TABLE "PaymentEntry" ADD COLUMN     "client" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'paid',
ADD COLUMN     "tip" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "PaymentEntry_userId_paymentStatus_idx" ON "PaymentEntry"("userId", "paymentStatus");


-- Los trabajos que ya existían se consideran cobrados al terminar
UPDATE "PaymentEntry" SET "paidAt" = COALESCE("endTime", "updatedAt") WHERE "completed" = true AND "paidAt" IS NULL;
