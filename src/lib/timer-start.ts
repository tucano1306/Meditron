// Hora de inicio elegida a mano: para cuando se olvida iniciar el cronómetro
// (empezar desde una hora anterior) o se quiere corregir el inicio del turno en
// curso. Un turno no puede cruzarse con el anterior: solo hay uno a la vez.
// Sirve para los dos modos: por hora (TimeEntry) y por pago (PaymentEntry).

import { prisma } from './prisma'
import { formatTime12 } from './report-format'

/** Lo más atrás que se puede poner el inicio de un turno */
export const MAX_BACKDATE_HOURS = 24
/** Diferencia de reloj tolerada entre el teléfono y el servidor */
const CLOCK_SKEW_MS = 2 * 60 * 1000

function finishedBefore(excludeId?: string) {
  return {
    endTime: { not: null, lte: new Date(Date.now() + CLOCK_SKEW_MS) },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  }
}

/** Fin del último turno por hora terminado del usuario (sin contar `excludeId`) */
export async function lastEndTime(userId: string, excludeId?: string): Promise<Date | null> {
  const last = await prisma.timeEntry.findFirst({
    where: { userId, ...finishedBefore(excludeId) },
    orderBy: { endTime: 'desc' },
    select: { endTime: true },
  })
  return last?.endTime ?? null
}

/** Fin del último trabajo por pago terminado del usuario (sin contar `excludeId`) */
export async function lastPaymentEndTime(userId: string, excludeId?: string): Promise<Date | null> {
  const last = await prisma.paymentEntry.findFirst({
    where: { userId, ...finishedBefore(excludeId) },
    orderBy: { endTime: 'desc' },
    select: { endTime: true },
  })
  return last?.endTime ?? null
}

/** Revisa una hora de inicio contra ahora y el fin del turno anterior: devuelve el error o null */
export function checkStartTime(start: Date, lastEnd: Date | null): string | null {
  if (Number.isNaN(start.getTime())) return 'Hora de inicio inválida'
  const now = Date.now()
  if (start.getTime() > now + CLOCK_SKEW_MS) return 'La hora de inicio no puede ser en el futuro'
  if (start.getTime() < now - MAX_BACKDATE_HOURS * 3600 * 1000) {
    return `La hora de inicio no puede ser de hace más de ${MAX_BACKDATE_HOURS} horas`
  }
  if (lastEnd && start.getTime() < lastEnd.getTime() - 60 * 1000) {
    return `Se cruza con tu turno anterior, que terminó a las ${formatTime12(lastEnd)}`
  }
  return null
}

/** Valida la hora de inicio de un turno por hora: devuelve el error o null */
export async function validateStartTime(userId: string, start: Date, excludeId?: string): Promise<string | null> {
  return checkStartTime(start, await lastEndTime(userId, excludeId))
}
