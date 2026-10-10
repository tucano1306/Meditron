-- Compañías configurables por usuario y sus esquemas de pago (versionados por fecha)

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#37352f',
    "weekStartsOn" INTEGER NOT NULL DEFAULT 1,
    "trackJobNumber" BOOLEAN NOT NULL DEFAULT false,
    "trackVehicle" BOOLEAN NOT NULL DEFAULT false,
    "trackServiceType" BOOLEAN NOT NULL DEFAULT false,
    "trackCompanyPaid" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPayRule" (
    "id" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "payType" TEXT NOT NULL DEFAULT 'hourly',
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "overtimeAfterHours" DOUBLE PRECISION,
    "overtimeMultiplier" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CompanyPayRule_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN "companyId" TEXT;

-- CreateIndex
CREATE INDEX "Company_userId_idx" ON "Company"("userId");

-- CreateIndex
CREATE INDEX "CompanyPayRule_companyId_idx" ON "CompanyPayRule"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPayRule_companyId_effectiveFrom_key" ON "CompanyPayRule"("companyId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TimeEntry_companyId_idx" ON "TimeEntry"("companyId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPayRule" ADD CONSTRAINT "CompanyPayRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
