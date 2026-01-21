import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const HOURLY_RATE = 25

// ========== ZONA HORARIA FLORIDA (America/New_York) ==========
const FLORIDA_TIMEZONE = 'America/New_York'

/**
 * Obtiene la fecha/hora actual en Florida
 */
export function getFloridaDate(): Date {
  // Crear fecha en zona horaria de Florida
  const now = new Date()
  const floridaString = now.toLocaleString('en-US', { timeZone: FLORIDA_TIMEZONE })
  return new Date(floridaString)
}

/**
 * Convierte una fecha UTC a fecha de Florida
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
  // Esto nos permite calcular la semana correcta según la hora de Florida
  const d = new Date(florida.year, florida.month - 1, florida.day)
  
  // Cálculo ISO 8601: semana comienza en lunes
  // Ajustar al jueves más cercano (ISO semanas se definen por el jueves)
  const dayNum = d.getDay() || 7 // Domingo = 7
  d.setDate(d.getDate() + 4 - dayNum)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function getWeekStartEnd(date: Date): { start: Date; end: Date } {
  // Usar zona horaria de Florida
  const florida = getFloridaDateComponents(date)
  const dayOfWeek = florida.dayOfWeek
  
  // Calcular el lunes de esta semana
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  
  const start = new Date(florida.year, florida.month - 1, florida.day + diffToMonday, 0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  
  return { start, end }
}

export function getWeekStartEndFromWeekNumber(weekNumber: number, year: number): { start: Date; end: Date } {
  // ISO 8601: La semana 1 es la primera semana que contiene un jueves del año
  // o la primera semana que contiene el 4 de enero
  const jan4 = new Date(year, 0, 4)
  const dayNum = jan4.getDay() || 7 // Domingo = 7
  const weekOneMonday = new Date(jan4)
  weekOneMonday.setDate(jan4.getDate() - dayNum + 1)
  
  // Calcular el lunes de la semana solicitada
  const start = new Date(weekOneMonday)
  start.setDate(weekOneMonday.getDate() + (weekNumber - 1) * 7)
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
