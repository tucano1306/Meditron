import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const HOURLY_RATE = 25

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
  // Cálculo ISO 8601: semana comienza en lunes
  // Usar fecha LOCAL (no UTC) para respetar la zona horaria del sistema
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  // Ajustar al jueves más cercano (ISO semanas se definen por el jueves)
  const dayNum = d.getDay() || 7 // Domingo = 7
  d.setDate(d.getDate() + 4 - dayNum)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function getWeekStartEnd(date: Date): { start: Date; end: Date } {
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  
  const start = new Date(date)
  start.setDate(date.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  
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
