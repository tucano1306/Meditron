import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const HOURLY_RATE = 25

// ========== ZONA HORARIA FLORIDA (America/New_York) ==========
const FLORIDA_TIMEZONE = 'America/New_York'

/**
 * Obtiene la fecha/hora actual en Florida (para mostrar, NO para cálculos de tiempo)
 * IMPORTANTE: Esta función devuelve una fecha con componentes de Florida pero
 * el timestamp interno NO es correcto para cálculos de diferencia de tiempo.
 * Para cálculos de elapsed time, usar new Date() directamente.
 */
export function getFloridaDate(): Date {
  // Crear fecha en zona horaria de Florida
  const now = new Date()
  const floridaString = now.toLocaleString('en-US', { timeZone: FLORIDA_TIMEZONE })
  return new Date(floridaString)
}

/**
 * Obtiene el timestamp real actual (para cálculos de tiempo transcurrido)
 */
export function getCurrentTimestamp(): Date {
  return new Date()
}

/**
 * Convierte una fecha UTC a fecha de Florida (para mostrar, NO para cálculos)
 */
export function toFloridaDate(date: Date): Date {
  const floridaString = date.toLocaleString('en-US', { timeZone: FLORIDA_TIMEZONE })
  return new Date(floridaString)
}

/**
 * Obtiene los componentes de fecha en Florida (año, mes, día)
 */
export function getFloridaDateComponents(date: Date): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FLORIDA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  })
  
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  
  const weekdayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 }
  const weekdayStr = get('weekday')
  
  return {
    year: Number.parseInt(get('year')),
    month: Number.parseInt(get('month')),
    day: Number.parseInt(get('day')),
    hour: Number.parseInt(get('hour')),
    minute: Number.parseInt(get('minute')),
    dayOfWeek: weekdayMap[weekdayStr] ?? 0
  }
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function formatHoursDecimal(seconds: number): string {
  const hours = seconds / 3600
  return hours.toFixed(2)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

export function getWeekNumber(date: Date): number {
  // Usar zona horaria de Florida para determinar la semana
  const florida = getFloridaDateComponents(date)
  
  // Crear una fecha "virtual" con los componentes de Florida
  const d = new Date(florida.year, florida.month - 1, florida.day)
  
  // Calcular el número de semana ISO 8601 (Lunes-Domingo)
  // La semana 1 es la primera semana con al menos 4 días en el nuevo año
  const dayOfWeek = d.getDay() // 0 = domingo, 1 = lunes, etc.
  
  // Convertir a ISO: Lunes = 1, Domingo = 7
  const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek
  
  // Encontrar el jueves de esta semana (el jueves determina en qué año cae la semana)
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + (4 - isoDayOfWeek))
  
  // El año de la semana ISO es el año del jueves
  const isoYear = thursday.getFullYear()
  
  // Encontrar el primer jueves del año ISO
  const jan4 = new Date(isoYear, 0, 4) // 4 de enero siempre está en semana 1
  const jan4DayOfWeek = jan4.getDay() === 0 ? 7 : jan4.getDay()
  const firstThursday = new Date(isoYear, 0, 4 - jan4DayOfWeek + 4)
  
  // Calcular el número de semana
  const weekNum = Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000) + 1
  
  return weekNum
}

export function getWeekStartEnd(date: Date): { start: Date; end: Date } {
  // Usar zona horaria de Florida
  const florida = getFloridaDateComponents(date)
  const dayOfWeek = florida.dayOfWeek // 0 = domingo, 1 = lunes, ..., 6 = sábado
  
  // Semana ISO: Lunes-Domingo
  // Convertir a ISO: Lunes = 1, Domingo = 7
  const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek
  
  // Calcular el lunes de esta semana (inicio de semana ISO)
  const diffToMonday = 1 - isoDayOfWeek
  
  const start = new Date(florida.year, florida.month - 1, florida.day + diffToMonday, 0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6) // Domingo
  end.setHours(23, 59, 59, 999)
  
  return { start, end }
}

export function getWeekStartEndFromWeekNumber(weekNumber: number, year: number): { start: Date; end: Date } {
  // Semanas ISO 8601: Lunes-Domingo
  // Semana 1 es la primera semana con al menos 4 días en el nuevo año
  
  // Encontrar el 4 de enero (siempre está en la semana 1)
  const jan4 = new Date(year, 0, 4)
  const jan4DayOfWeek = jan4.getDay() // 0 = domingo
  
  // Convertir a ISO: Lunes = 1, Domingo = 7
  const isoJan4DayOfWeek = jan4DayOfWeek === 0 ? 7 : jan4DayOfWeek
  
  // Encontrar el lunes de la semana 1
  const firstMonday = new Date(year, 0, 4 - isoJan4DayOfWeek + 1)
  
  // Calcular el lunes de la semana solicitada
  const start = new Date(firstMonday)
  start.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
  start.setHours(0, 0, 0, 0)
  
  // El domingo es 6 días después del lunes
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  
  return { start, end }
}

export function getMonthName(month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  return months[month - 1] || ''
}

// Parsea una fecha ISO como fecha local (evita problemas de timezone)
export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date()
  const str = dateString.split('T')[0]
  const [year, month, day] = str.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Parsea una fecha ISO completa preservando la hora local del cliente
// El cliente envía su hora local como ISO string (que incluye el offset o está en UTC)
// Esta función la convierte a la misma hora en la zona local del servidor
export function parseClientDateTime(isoString: string): Date {
  if (!isoString) return new Date()
  
  // Si el cliente envía timestamp con formato ISO (ej: 2026-01-19T20:39:13.000Z)
  // Extraemos los componentes directamente para preservar la hora local del cliente
  const regex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  const match = regex.exec(isoString)
  if (match) {
    const [, year, month, day, hour, minute, second] = match.map(Number)
    return new Date(year, month - 1, day, hour, minute, second)
  }
  
  // Fallback: parsear normalmente
  return new Date(isoString)
}

// ========== FUNCIONES DE FORMATO CON ZONA HORARIA FLORIDA ==========

/**
 * Formatea una fecha para mostrarla en zona horaria de Florida
 * @param date - Fecha (string ISO o Date)
 * @param options - Opciones de formato Intl.DateTimeFormat
 */
export function formatDateInFlorida(date: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('es-ES', {
    timeZone: FLORIDA_TIMEZONE,
    ...options
  })
}

/**
 * Formatea una hora para mostrarla en zona horaria de Florida
 * @param date - Fecha (string ISO o Date)
 * @param options - Opciones de formato Intl.DateTimeFormat
 */
export function formatTimeInFlorida(date: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleTimeString('es-ES', {
    timeZone: FLORIDA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...options
  })
}

/**
 * Formatea fecha y hora completa en zona horaria de Florida
 */
export function formatDateTimeInFlorida(date: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleString('es-ES', {
    timeZone: FLORIDA_TIMEZONE,
    ...options
  })
}

/**
 * Obtiene la fecha corta en Florida (día, mes corto)
 */
export function formatShortDateFlorida(date: string | Date): string {
  return formatDateInFlorida(date, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
}

/**
 * Obtiene la fecha larga en Florida
 */
export function formatLongDateFlorida(date: string | Date): string {
  return formatDateInFlorida(date, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Obtiene la fecha actual en Florida como string YYYY-MM-DD
 */
export function getFloridaDateString(): string {
  const components = getFloridaDateComponents(new Date())
  return `${components.year}-${String(components.month).padStart(2, '0')}-${String(components.day).padStart(2, '0')}`
}

/**
 * Obtiene el timestamp actual ajustado a Florida para calcular elapsed time correctamente
 */
export function getFloridaNow(): Date {
  return getFloridaDate()
}
