-- Break sin pago por compañía y descontado en cada turno
ALTER TABLE "Company" ADD COLUMN     "breakAfterHours" DOUBLE PRECISION NOT NULL DEFAULT 6,
ADD COLUMN     "breakMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "TimeEntry" ADD COLUMN     "breakSeconds" INTEGER;

-- Columnas de correcciones que se crearon en producción sin migración: así una
-- base nueva queda igual (en producción ya existen y no se tocan)
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "correctionNote" TEXT;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "correctionPending" BOOLEAN NOT NULL DEFAULT false;
