// Pasar trabajos de "Por pago" a una compañía de "Por hora".
//
// Antes, el cronómetro de Por Pago pedía # de trabajo y vehículo, así que
// algunos trabajos de compañías por hora (como Larry's) quedaron guardados en
// Por Pago. Esto los convierte en registros de Por Hora con sus horas, su
// número, su vehículo y lo que te pagaron, y los quita de Por Pago.
//
// Este módulo no usa Prisma: lo comparten el backend y el frontend.

import { ruleFor, type Company } from './companies'
import { jobEarned, methodLabel, type PaymentJob } from './payment-jobs'
import { formatCurrency } from './utils'

/** Monto del registro: horas × la tarifa de la compañía, o lo que te pagaron */
export type MoveAmount = 'rate' | 'keep'

/**
 * Qué hacer con los que ya parecen estar en Por Hora: no mover nada
 * (para preguntar), dejarlos en Por Pago, quitarlos de Por Pago, o pasarlos
 * igual (no eran el mismo trabajo).
 */
export type DuplicateMode = 'stop' | 'skip' | 'remove' | 'include'

/** Trabajos por vez (lo que trae una búsqueda) */
export const MAX_MOVE = 500

export function isMoveAmount(value: unknown): value is MoveAmount {
  return value === 'rate' || value === 'keep'
}

export function isDuplicateMode(value: unknown): value is DuplicateMode {
  return value === 'stop' || value === 'skip' || value === 'remove' || value === 'include'
}

/** La compañía paga ese día por hora sin overtime (se puede escribir el monto) */
export function plainHourlyOn(company: Company, dateKey: string): boolean {
  return ruleFor(company, dateKey).payType === 'hourly'
}

/** Monto que tendrá el registro en Por Hora */
export function hourlyAmountFor(company: Company, job: Pick<PaymentJob, 'date' | 'duration' | 'amount' | 'tip'>, mode: MoveAmount): number {
  if (mode === 'keep' && plainHourlyOn(company, job.date)) return round(jobEarned(job))
  return round((job.duration / 3600) * ruleFor(company, job.date).hourlyRate)
}

/** Lo que la compañía te pagó por el trabajo (solo si ya lo cobraste) */
export function companyPaidFor(job: Pick<PaymentJob, 'amount' | 'paymentStatus'>): number | null {
  return job.paymentStatus === 'paid' && job.amount > 0 ? round(job.amount) : null
}

/** Nota del registro: lo de Por Pago que no tiene lugar propio en Por Hora */
export function observationFor(job: Pick<PaymentJob, 'client' | 'notes' | 'tip' | 'paymentMethod'>): string | null {
  const parts = [
    job.client ? `Cliente: ${job.client}` : null,
    job.tip > 0 ? `Propina ${formatCurrency(job.tip)}` : null,
    job.paymentMethod ? `Método de pago: ${methodLabel(job.paymentMethod) ?? job.paymentMethod}` : null,
    job.notes,
  ].filter((p): p is string => Boolean(p))
  if (parts.length === 0) return null
  return parts.join(' · ').slice(0, 1000)
}

// ── Duplicados ────────────────────────────────────────────────────────────────

/** Un registro de Por Hora, lo justo para compararlo */
export interface HourlyEntryLike {
  id: string
  /** YYYY-MM-DD */
  date: string
  startTime: string
  endTime: string | null
  jobNumber: string | null
  companyId: string | null
}

const DAY_MS = 24 * 3600 * 1000

function normalizeJobNumber(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/^#/, '').toLowerCase()
}

/**
 * Registro de Por Hora que ya parece ser este trabajo: el mismo número de
 * trabajo en el mismo día (o el de al lado, por la medianoche), o casi las
 * mismas horas (se pisan en más de la mitad del más corto).
 */
export function findHourlyDuplicate<T extends HourlyEntryLike>(
  job: Pick<PaymentJob, 'date' | 'startTime' | 'endTime' | 'jobNumber'>,
  entries: readonly T[],
): T | null {
  const number = normalizeJobNumber(job.jobNumber)
  const jobDay = Date.parse(`${job.date}T00:00:00Z`)
  const start = Date.parse(job.startTime)
  const end = Date.parse(job.endTime)

  for (const entry of entries) {
    if (number && normalizeJobNumber(entry.jobNumber) === number) {
      const entryDay = Date.parse(`${entry.date}T00:00:00Z`)
      if (Math.abs(entryDay - jobDay) <= DAY_MS) return entry
    }
  }
  for (const entry of entries) {
    if (!entry.endTime) continue
    const otherStart = Date.parse(entry.startTime)
    const otherEnd = Date.parse(entry.endTime)
    const overlap = Math.min(end, otherEnd) - Math.max(start, otherStart)
    const shorter = Math.min(end - start, otherEnd - otherStart)
    if (overlap > 0 && shorter > 0 && overlap >= shorter / 2) return entry
  }
  return null
}

// ── Respuesta de la API ───────────────────────────────────────────────────────

export interface MoveDuplicate {
  /** Trabajo de Por Pago */
  jobId: string
  jobTitle: string
  /** Registro de Por Hora que ya existe */
  entry: { id: string; date: string; startTime: string; endTime: string | null; jobNumber: string | null; companyName: string | null }
}

export interface MoveResult {
  /** Pasados a Por Hora */
  moved: number
  /** Quitados de Por Pago porque ya estaban en Por Hora */
  removed: number
  /** Dejados en Por Pago porque ya estaban en Por Hora */
  skipped: number
  companyName: string
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** Aviso al terminar */
export function moveMessage(result: MoveResult): string {
  const parts: string[] = []
  if (result.moved > 0) {
    parts.push(result.moved === 1 ? `Pasado a ${result.companyName}` : `${result.moved} trabajos pasados a ${result.companyName}`)
  }
  if (result.removed > 0) {
    parts.push(result.removed === 1 ? 'quitado de Por Pago el repetido' : `${result.removed} repetidos quitados de Por Pago`)
  }
  if (result.skipped > 0) {
    parts.push(result.skipped === 1 ? 'el repetido se quedó en Por Pago' : `${result.skipped} repetidos se quedaron en Por Pago`)
  }
  if (parts.length === 0) return 'No había nada que pasar'
  const text = parts.join(' · ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
