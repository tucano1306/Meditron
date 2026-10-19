// Formato de fechas, horas y montos para los reportes (PDF y CSV).
// Las fechas llegan como claves YYYY-MM-DD; las horas, como instantes UTC que
// se muestran en hora de Florida.

import { getFloridaDateComponents } from './utils'
import { addDaysToKey, dateKeyToUTC } from './companies'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function dayName(key: string): string {
  return DAY_NAMES[dateKeyToUTC(key).getUTCDay()]
}

/** "10/4/2026" — mismo formato que las relaciones de pago */
export function formatKeyUS(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${m}/${d}/${y}`
}

/** "Domingo 4 oct 2026" */
export function formatKeyLong(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${dayName(key)} ${d} ${MONTH_SHORT[m - 1]} ${y}`
}

/** "8:00 AM" en hora de Florida */
export function formatTime12(iso: string | Date): string {
  const { hour, minute } = getFloridaDateComponents(new Date(iso))
  const h = hour % 24
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`
}

export function hoursDecimal(seconds: number): string {
  return (seconds / 3600).toFixed(2)
}

/** Break descontado de un turno: "30 min" */
export function breakLabel(seconds: number): string {
  return `${Math.round(seconds / 60)} min`
}

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function money(amount: number): string {
  return moneyFormatter.format(amount)
}

/** La nota en una sola línea para tablas y exportaciones */
export function noteText(note: string | null | undefined): string {
  return (note ?? '').replaceAll(/\s+/g, ' ').trim()
}

/** "dom 4 oct" */
export function formatKeyShort(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  return `${DAY_SHORT[dateKeyToUTC(key).getUTCDay()]} ${d} ${MONTH_SHORT[m - 1]}`
}

export interface DayTotal {
  /** YYYY-MM-DD */
  date: string
  entries: number
  seconds: number
  amount: number
}

/** Totales de cada uno de los 7 días de la semana de pago (también los días sin horas) */
export function dailyTotals(period: { start: string; entries: { date: string; duration: number | null; amount: number }[] }): DayTotal[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToKey(period.start, i)
    const list = period.entries.filter(e => e.date.slice(0, 10) === date)
    return {
      date,
      entries: list.length,
      seconds: list.reduce((sum, e) => sum + (e.duration ?? 0), 0),
      amount: list.reduce((sum, e) => sum + e.amount, 0),
    }
  })
}

/**
 * Celda de CSV. Un texto que empieza con = + - @ (o tabulador) Excel lo toma
 * como fórmula: se le antepone un apóstrofo para que se vea como texto y no se
 * ejecute (inyección de fórmulas). Los números negativos se dejan igual.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
