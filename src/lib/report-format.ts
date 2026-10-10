// Formato de fechas, horas y montos para los reportes (PDF y CSV).
// Las fechas llegan como claves YYYY-MM-DD; las horas, como instantes UTC que
// se muestran en hora de Florida.

import { getFloridaDateComponents } from './utils'
import { dateKeyToUTC, withCompanyTag } from './companies'

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

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function money(amount: number): string {
  return moneyFormatter.format(amount)
}

/** La nota sin la etiqueta "Tecnofuel" (en el reporte ya se sabe la compañía). */
export function noteWithoutTag(note: string | null | undefined): string {
  return withCompanyTag(note, 'larrys') ?? ''
}

/** "dom 4 oct" */
export function formatKeyShort(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  return `${DAY_SHORT[dateKeyToUTC(key).getUTCDay()]} ${d} ${MONTH_SHORT[m - 1]}`
}
