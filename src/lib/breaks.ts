// Break sin pago en turnos ya terminados: ponerlo o quitarlo deja todo
// coherente (duración pagada, monto, overtime y totales de semanas y meses).
//
// La duración de un turno (`duration`) es el tiempo pagado: lo trabajado con el
// cronómetro (sin pausas) menos el break. `breakSeconds` guarda cuánto se
// descontó, así se puede devolver.

import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { updateMonthSummary, updateWeekTotals } from './week-utils'
import { recalculateCompanyAmounts } from './pay-periods'
import {
  breakRuleOf,
  breakToDeduct,
  dateKeyToUTC,
  payScopeOf,
  ruleFor,
  toDateKey,
  type Company,
} from './companies'

const breakEntrySelect = {
  id: true, startTime: true, endTime: true, duration: true, breakSeconds: true,
  date: true, calculatedAmount: true, weekId: true,
  week: { select: { year: true, month: true } },
} satisfies Prisma.TimeEntrySelect

export type BreakEntry = Prisma.TimeEntryGetPayload<{ select: typeof breakEntrySelect }>

/** Lo trabajado con el cronómetro, antes de descontar el break */
export function workedSeconds(entry: Pick<BreakEntry, 'duration' | 'breakSeconds'>): number {
  return (entry.duration ?? 0) + (entry.breakSeconds ?? 0)
}

/** De la entrada a la salida */
export function shiftSeconds(entry: Pick<BreakEntry, 'startTime' | 'endTime'>): number {
  return entry.endTime ? Math.floor((entry.endTime.getTime() - entry.startTime.getTime()) / 1000) : 0
}

/**
 * Cambia el break de turnos terminados de una compañía. Por hora, el monto se
 * ajusta solo si seguía la tarifa (se respetan los montos puestos a mano); con
 * overtime se recalcula el grupo completo. Devuelve cuántos turnos cambiaron.
 */
export async function setEntryBreaks(
  userId: string,
  company: Company,
  changes: { entry: BreakEntry; breakSeconds: number }[]
): Promise<number> {
  const updates: { entry: BreakEntry; data: Prisma.TimeEntryUpdateInput }[] = []
  for (const { entry, breakSeconds } of changes) {
    const worked = workedSeconds(entry)
    // Nunca deja el turno en menos de un minuto
    const next = Math.max(0, Math.min(Math.round(breakSeconds), worked - 60))
    if (next === (entry.breakSeconds ?? 0)) continue

    const duration = worked - next
    const dateKey = toDateKey(entry.date)
    const data: Prisma.TimeEntryUpdateInput = { duration, breakSeconds: next }
    if (payScopeOf(company, dateKey, entry.id).kind === 'entry') {
      const rate = ruleFor(company, dateKey).hourlyRate
      const followedRate = entry.calculatedAmount === null
        || Math.abs(entry.calculatedAmount - ((entry.duration ?? 0) / 3600) * rate) < 0.01
      if (followedRate) data.calculatedAmount = (duration / 3600) * rate
    }
    updates.push({ entry, data })
  }
  if (updates.length === 0) return 0

  await prisma.$transaction(updates.map(u => prisma.timeEntry.update({ where: { id: u.entry.id }, data: u.data })))
  await recalculateCompanyAmounts(userId, company, [...new Set(updates.map(u => toDateKey(u.entry.date)))])
  for (const weekId of new Set(updates.map(u => u.entry.weekId))) await updateWeekTotals(weekId, userId)
  const months = new Map(updates.map(u => [`${u.entry.week.year}-${u.entry.week.month}`, u.entry.week]))
  for (const { year, month } of months.values()) await updateMonthSummary(year, month, userId)
  return updates.length
}

/** Turno terminado del usuario, con lo necesario para cambiarle el break */
export async function findBreakEntry(userId: string, id: string): Promise<BreakEntry | null> {
  return prisma.timeEntry.findFirst({
    where: { id, userId, endTime: { not: null }, duration: { not: null } },
    select: breakEntrySelect,
  })
}

/**
 * Pone (según la regla de la compañía) o quita el break de todos los turnos
 * terminados de la compañía desde `from` (YYYY-MM-DD). Devuelve cuántos cambiaron.
 */
export async function applyCompanyBreak(userId: string, company: Company, from: string, apply: boolean): Promise<number> {
  const rule = breakRuleOf(company)
  const entries = await prisma.timeEntry.findMany({
    where: { userId, companyId: company.id, endTime: { not: null }, duration: { not: null }, date: { gte: dateKeyToUTC(from) } },
    select: breakEntrySelect,
  })
  return setEntryBreaks(userId, company, entries.map(entry => ({
    entry,
    breakSeconds: apply ? breakToDeduct(rule, shiftSeconds(entry), workedSeconds(entry)) : 0,
  })))
}
