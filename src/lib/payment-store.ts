// Servidor del modo "Por pago": validación de los datos de un trabajo y
// conversión de la fila de la base a lo que usa la app.

import type { PaymentEntry, Prisma } from '@prisma/client'
import { floridaShiftToUTC } from './utils'
import { toDateKey } from './companies'
import { isPaymentMethod, type PaymentJob } from './payment-jobs'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/
const MAX_SHIFT_SECONDS = 24 * 3600

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export function serializeJob(row: PaymentEntry): PaymentJob {
  const start = row.startTime
  const end = row.endTime ?? row.startTime
  return {
    id: row.id,
    date: toDateKey(row.date),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    duration: row.duration ?? Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)),
    amount: row.amount ?? 0,
    tip: row.tip ?? 0,
    client: row.client,
    jobNumber: row.jobNumber,
    vehicle: row.vehicle,
    notes: row.notes,
    paymentMethod: isPaymentMethod(row.paymentMethod) ? row.paymentMethod : null,
    paymentStatus: row.paymentStatus === 'pending' ? 'pending' : 'paid',
    paidAt: row.paidAt?.toISOString() ?? null,
  }
}

function money(value: unknown, field: string, required: boolean): Result<number | null> {
  if (value === undefined || value === null || value === '') {
    return required ? { ok: false, error: `${field} es obligatorio` } : { ok: true, value: null }
  }
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100000) return { ok: false, error: `${field} inválido` }
  return { ok: true, value: Math.round(n * 100) / 100 }
}

function text(value: unknown, field: string, max: number): Result<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, error: `${field} inválido` }
  const trimmed = value.trim()
  if (trimmed.length > max) return { ok: false, error: `${field}: máximo ${max} caracteres` }
  return { ok: true, value: trimmed || null }
}

/**
 * Datos de un trabajo (crear o editar). Las horas llegan como fecha + hora de
 * entrada y salida en Florida; si la salida es antes que la entrada, el trabajo
 * cruzó la medianoche. Con `partial` solo se validan los campos que vienen.
 */
export function parseJobInput(body: Record<string, unknown>, partial: boolean): Result<Prisma.PaymentEntryUncheckedUpdateInput> {
  const data: Prisma.PaymentEntryUncheckedUpdateInput = {}
  const touchesTime = body.date !== undefined || body.start !== undefined || body.end !== undefined

  let seconds: number | null = null
  if (touchesTime || !partial) {
    const { date, start, end } = body
    if (typeof date !== 'string' || !DATE_KEY.test(date)) return { ok: false, error: 'Fecha inválida' }
    if (typeof start !== 'string' || !TIME.test(start) || typeof end !== 'string' || !TIME.test(end)) {
      return { ok: false, error: 'Hora de inicio o fin inválida' }
    }
    const times = floridaShiftToUTC(date, start, end)
    if (!times) return { ok: false, error: 'Revisa la fecha y las horas' }
    seconds = Math.round((times.end.getTime() - times.start.getTime()) / 1000)
    if (seconds <= 0 || seconds > MAX_SHIFT_SECONDS) return { ok: false, error: 'El trabajo debe durar entre 1 minuto y 24 horas' }
    if (times.start.getTime() > Date.now() + 5 * 60 * 1000) return { ok: false, error: 'El trabajo no puede empezar en el futuro' }
    data.date = new Date(`${date}T00:00:00Z`)
    data.startTime = times.start
    data.endTime = times.end
    data.duration = seconds
  }

  if (body.amount !== undefined || !partial) {
    const amount = money(body.amount, 'El pago', true)
    if (!amount.ok) return amount
    if (!amount.value) return { ok: false, error: 'El pago debe ser mayor que 0' }
    data.amount = amount.value
  }
  if (body.tip !== undefined) {
    const tip = money(body.tip, 'La propina', false)
    if (!tip.ok) return tip
    data.tip = tip.value
  }

  const texts: [keyof typeof body, 'client' | 'jobNumber' | 'vehicle' | 'notes', string, number][] = [
    ['client', 'client', 'El cliente', 80],
    ['jobNumber', 'jobNumber', 'El número de trabajo', 30],
    ['vehicle', 'vehicle', 'El vehículo', 30],
    ['notes', 'notes', 'Las notas', 500],
  ]
  for (const [key, field, label, max] of texts) {
    if (body[key] === undefined) continue
    const value = text(body[key], label, max)
    if (!value.ok) return value
    data[field] = value.value
  }

  if (body.paymentMethod !== undefined) {
    if (body.paymentMethod !== null && body.paymentMethod !== '' && !isPaymentMethod(body.paymentMethod)) {
      return { ok: false, error: 'Método de pago inválido' }
    }
    data.paymentMethod = body.paymentMethod || null
  }
  if (body.paymentStatus !== undefined || !partial) {
    const status = body.paymentStatus ?? 'paid'
    if (status !== 'paid' && status !== 'pending') return { ok: false, error: 'Estado de cobro inválido' }
    data.paymentStatus = status
  }

  return { ok: true, value: data }
}

/**
 * Completa los campos derivados al guardar: la tarifa guardada (pago entre
 * horas) y la fecha de cobro según el estado.
 */
export function withDerivedFields(
  data: Prisma.PaymentEntryUncheckedUpdateInput,
  current: Pick<PaymentEntry, 'amount' | 'duration' | 'paymentStatus' | 'paidAt'> | null
): Prisma.PaymentEntryUncheckedUpdateInput {
  const amount = (typeof data.amount === 'number' ? data.amount : current?.amount) ?? 0
  const duration = (typeof data.duration === 'number' ? data.duration : current?.duration) ?? 0
  const result = { ...data, hourlyRate: duration > 0 ? amount / (duration / 3600) : 0 }
  const status = typeof data.paymentStatus === 'string' ? data.paymentStatus : current?.paymentStatus ?? 'paid'
  if (status === 'pending') result.paidAt = null
  else if (!current?.paidAt || current.paymentStatus === 'pending') result.paidAt = new Date()
  return result
}
