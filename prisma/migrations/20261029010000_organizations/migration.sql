-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "weekStartsOn" INTEGER NOT NULL DEFAULT 1,
    "requireLocation" BOOLEAN NOT NULL DEFAULT true,
    "overtimeAfterHours" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "overtimeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "breakAfterHours" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" DOUBLE PRECISION NOT NULL DEFAULT 1609.34,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "OrgLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'employee',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgShift" (
    "id" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "date" DATE NOT NULL,
    "breakSeconds" INTEGER NOT NULL DEFAULT 0,
    "inLatitude" DOUBLE PRECISION,
    "inLongitude" DOUBLE PRECISION,
    "inAccuracy" DOUBLE PRECISION,
    "inDistance" DOUBLE PRECISION,
    "outLatitude" DOUBLE PRECISION,
    "outLongitude" DOUBLE PRECISION,
    "outAccuracy" DOUBLE PRECISION,
    "outDistance" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'clock',
    "correctionNote" TEXT,
    "correctionStatus" TEXT,
    "adminNote" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "OrgShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgShiftEdit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shiftId" TEXT NOT NULL,

    CONSTRAINT "OrgShiftEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_joinCode_key" ON "Organization"("joinCode");

-- CreateIndex
CREATE INDEX "OrgLocation_orgId_idx" ON "OrgLocation"("orgId");

-- CreateIndex
CREATE INDEX "OrgMember_userId_idx" ON "OrgMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_orgId_userId_key" ON "OrgMember"("orgId", "userId");

-- CreateIndex
CREATE INDEX "OrgShift_orgId_date_idx" ON "OrgShift"("orgId", "date");

-- CreateIndex
CREATE INDEX "OrgShift_memberId_clockIn_idx" ON "OrgShift"("memberId", "clockIn");

-- CreateIndex
CREATE INDEX "OrgShiftEdit_shiftId_idx" ON "OrgShiftEdit"("shiftId");

-- AddForeignKey
ALTER TABLE "OrgLocation" ADD CONSTRAINT "OrgLocation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgShift" ADD CONSTRAINT "OrgShift_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgShift" ADD CONSTRAINT "OrgShift_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "OrgMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgShiftEdit" ADD CONSTRAINT "OrgShiftEdit_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "OrgShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

