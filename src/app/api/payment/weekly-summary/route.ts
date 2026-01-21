import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getWeekNumber, getWeekStartEndFromWeekNumber, getFloridaDate, toFloridaDate } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Resumen semanal de pagos
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    // Usar hora de Florida para el cálculo
    const now = getFloridaDate()

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

    // Agrupar entradas por semana usando zona horaria de Florida
    const weeklyMap = new Map<string, {
      weekNumber: number
      year: number
      entries: typeof entries
    }>()

    entries.forEach(entry => {
      // Convertir la fecha a zona horaria de Florida para calcular la semana
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
      const calculatedAmount = week.entries.reduce((sum, e) => sum + (e.amount || 0), 0)
      const companyPaidAmount = week.entries.reduce((sum, e) => sum + (e.companyPaid || 0), 0)
      const difference = companyPaidAmount - calculatedAmount
      const differencePercentage = calculatedAmount > 0 
        ? (difference / calculatedAmount) * 100 
        : 0

      // Usar getWeekStartEndFromWeekNumber para obtener fechas consistentes
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
