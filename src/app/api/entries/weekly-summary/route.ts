import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getWeekNumber, getFloridaDate, toFloridaDate, getWeekStartEndFromWeekNumber, HOURLY_RATE } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Resumen semanal de entradas por hora
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    // Usar hora de Florida
    const now = getFloridaDate()

    // Obtener entradas de los últimos 60 días
    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(now.getDate() - 60)

    const entries = await prisma.timeEntry.findMany({
      where: {
        userId,
        endTime: { not: null },
        date: {
          gte: sixtyDaysAgo
        }
      },
      orderBy: {
        date: 'desc'
      }
    })

    // Agrupar entradas por semana usando zona horaria de Florida
    const weeklyMap = new Map<string, {
      weekNumber: number
      year: number
      entries: typeof entries
    }>()

    entries.forEach(entry => {
      // Convertir a zona horaria de Florida
      const floridaDate = toFloridaDate(new Date(entry.date))
      const weekNumber = getWeekNumber(floridaDate)
      const year = floridaDate.getFullYear()
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
      
      // Calcular monto basado en horas si calculatedAmount no está definido
      const calculatedAmount = week.entries.reduce((sum, e) => {
        if (e.calculatedAmount) return sum + e.calculatedAmount
        // Fallback: calcular basado en duración
        const hours = (e.duration || 0) / 3600
        return sum + (hours * HOURLY_RATE)
      }, 0)
      
      const companyPaidAmount = week.entries.reduce((sum, e) => sum + (e.companyPaid || 0), 0)
      const difference = companyPaidAmount - calculatedAmount
      const differencePercentage = calculatedAmount > 0 
        ? (difference / calculatedAmount) * 100 
        : 0

      // Usar getWeekStartEndFromWeekNumber para fechas consistentes
      const { start, end } = getWeekStartEndFromWeekNumber(week.weekNumber, week.year)

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
