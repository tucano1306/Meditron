// Formatos de pantalla compartidos por las vistas de compañías.

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "12h 30m" (o "45m" si no llega a una hora) */
export function formatHM(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

/** "5–11 oct" o "28 sep – 4 oct" */
export function formatRange(start: string, end: string): string {
  const [, m1, d1] = start.split('-').map(Number)
  const [, m2, d2] = end.split('-').map(Number)
  if (m1 === m2) return `${d1}–${d2} ${MONTH_SHORT[m2 - 1]}`
  return `${d1} ${MONTH_SHORT[m1 - 1]} – ${d2} ${MONTH_SHORT[m2 - 1]}`
}

/** Color de texto legible sobre el color (#rrggbb) de una compañía */
export function textOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const luminance = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return luminance > 150 ? '#37352f' : '#ffffff'
}

/** El color de la compañía con transparencia (0–1) */
export function withAlpha(hex: string, alpha: number): string {
  const value = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return `${hex}${value.toString(16).padStart(2, '0')}`
}
