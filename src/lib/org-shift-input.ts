// Horas que escribe un administrador al agregar o corregir un turno: fecha y
// horas de pared de Florida → instantes, con las mismas reglas para los dos casos.

import { floridaShiftToUTC, floridaWallTimeToUTC } from './utils'
import { isDateKey, optionalText } from './input'

const TIME = /^\d{2}:\d{2}$/
const MAX_SHIFT_SECONDS = 24 * 3600

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * `end` vacío = el turno sigue abierto (el empleado aún no sale). Si la salida
 * es antes que la entrada, el turno cruzó la medianoche.
 */
export function parseShiftTimes(body: Record<string, unknown>): Result<{ clockIn: Date; clockOut: Date | null; date: string }> {
  const { date, start, end } = body
  if (!isDateKey(date)) return { ok: false, error: 'Revisa la fecha' }
  if (typeof start !== 'string' || !TIME.test(start)) return { ok: false, error: 'Revisa la hora de entrada' }

  let clockIn: Date
  let clockOut: Date | null = null
  if (end === undefined || end === null || end === '') {
    const [y, m, d] = date.split('-').map(Number)
    const [h, mi] = start.split(':').map(Number)
    clockIn = floridaWallTimeToUTC(y, m, d, h, mi)
  } else {
    if (typeof end !== 'string' || !TIME.test(end)) return { ok: false, error: 'Revisa la hora de salida' }
    const times = floridaShiftToUTC(date, start, end)
    if (!times) return { ok: false, error: 'Revisa la fecha y las horas' }
    clockIn = times.start
    clockOut = times.end
    const seconds = (clockOut.getTime() - clockIn.getTime()) / 1000
    if (seconds <= 0 || seconds > MAX_SHIFT_SECONDS) return { ok: false, error: 'Un turno debe durar entre 1 minuto y 24 horas' }
  }
  const limit = Date.now() + 60 * 1000
  if (clockIn.getTime() > limit || (clockOut && clockOut.getTime() > limit)) {
    return { ok: false, error: 'Las horas no pueden ser en el futuro' }
  }
  return { ok: true, value: { clockIn, clockOut, date } }
}

/** Motivo obligatorio de todo cambio hecho por un administrador */
export function parseReason(value: unknown): Result<string> {
  const reason = optionalText(value, 'El motivo', 300)
  if (!reason.ok) return reason
  if (!reason.value || reason.value.length < 3) return { ok: false, error: 'Escribe el motivo del cambio (queda en el historial)' }
  return { ok: true, value: reason.value }
}

export function parseBreakMinutes(value: unknown): Result<number | undefined> {
  if (value === undefined || value === null || value === '') return { ok: true, value: undefined }
  const minutes = Number(value)
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 180) return { ok: false, error: 'El break debe ser de 0 a 180 minutos' }
  return { ok: true, value: minutes }
}
