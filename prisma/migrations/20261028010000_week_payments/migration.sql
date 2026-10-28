-- CreateTable
CREATE TABLE "WeekPayment" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION,
    "hours" DOUBLE PRECISION,
    "paidOn" DATE NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "WeekPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeekPayment_companyId_weekStart_key" ON "WeekPayment"("companyId", "weekStart");

-- AddForeignKey
ALTER TABLE "WeekPayment" ADD CONSTRAINT "WeekPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

