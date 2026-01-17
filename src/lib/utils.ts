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
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // Ajustar al jueves más cercano (ISO semanas se definen por el jueves)
  const dayNum = d.getUTCDay() || 7 // Domingo = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
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
