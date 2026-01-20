import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  return Math.ceil((days + startOfYear.getDay() + 1) / 7)
}

function getWeekStartEnd(weekNumber: number, year: number): { start: Date; end: Date } {
  const jan1 = new Date(year, 0, 1)
  const dayOfWeek = jan1.getDay()
  const daysToFirstMonday = (dayOfWeek === 0 ? 1 : 8 - dayOfWeek)
  
  const firstMonday = new Date(year, 0, daysToFirstMonday)
  const weekStart = new Date(firstMonday)
  weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  
  return { start: weekStart, end: weekEnd }
}

// GET - Resumen semanal de pagos
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const now = new Date()

    // Obtener entradas de los últimos 60 días
    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(now.getDate() - 60)

    const entries = await prisma.paymentEntry.findMany({
      where: {
        userId,
        completed: true,
        date: {
          gte: sixtyDaysAgo
        }
      },
      orderBy: {
        date: 'desc'
      }
    })

    // Agrupar entradas por semana
    const weeklyMap = new Map<string, {
      weekNumber: number
      year: number
      entries: typeof entries
    }>()

    entries.forEach(entry => {
      const date = new Date(entry.date)
      const weekNumber = getWeekNumber(date)
      const year = date.getFullYear()
      const key = `${year}-${weekNumber}`

      if (!weeklyMap.has(key)) {
        weeklyMap.set(key, {
          weekNumber,
          year,
          entries: []
        })
      }

      weeklyMap.get(key)!.entries.push(entry)
    })

    // Calcular estadísticas por semana
    const weeklySummaries = Array.from(weeklyMap.values()).map(week => {
      const totalJobs = week.entries.length
      const totalDuration = week.entries.reduce((sum, e) => sum + (e.duration || 0), 0)
      const totalHours = totalDuration / 3600
      const calculatedAmount = week.entries.reduce((sum, e) => sum + (e.amount || 0), 0)
      const companyPaidAmount = week.entries.reduce((sum, e) => sum + (e.companyPaid || 0), 0)
      const difference = companyPaidAmount - calculatedAmount
      const differencePercentage = calculatedAmount > 0 
        ? (difference / calculatedAmount) * 100 
        : 0

      const { start, end } = getWeekStartEnd(week.weekNumber, week.year)

      return {
        weekNumber: week.weekNumber,
        year: week.year,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalJobs,
        totalHours,
        calculatedAmount,
        companyPaidAmount,
        difference,
        differencePercentage
      }
    })

    // Ordenar por año y semana (más reciente primero)
    weeklySummaries.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.weekNumber - a.weekNumber
    })

    return NextResponse.json({
      success: true,
      data: weeklySummaries
    })
  } catch (error) {
    console.error('Error getting weekly summary:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener resumen semanal' },
      { status: 500 }
    )
  }
}
