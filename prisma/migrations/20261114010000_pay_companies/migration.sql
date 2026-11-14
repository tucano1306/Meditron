-- AlterTable
ALTER TABLE "PaymentEntry" ADD COLUMN     "amountAuto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "PayCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2e75cc',
    "payType" TEXT NOT NULL DEFAULT 'per_day',
    "rate" DOUBLE PRECISION,
    "paymentMethod" TEXT,
    "paysLater" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PayCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayCompany_userId_idx" ON "PayCompany"("userId");

-- CreateIndex
CREATE INDEX "PaymentEntry_companyId_date_idx" ON "PaymentEntry"("companyId", "date");

-- AddForeignKey
ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "PayCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayCompany" ADD CONSTRAINT "PayCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

