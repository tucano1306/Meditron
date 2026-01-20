import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getWeekNumber } from '@/lib/utils'

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
    const now = new Date()

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
      const calculatedAmount = week.entries.reduce((sum, e) => sum + (e.calculatedAmount || 0), 0)
      const companyPaidAmount = week.entries.reduce((sum, e) => sum + (e.companyPaid || 0), 0)
      const difference = companyPaidAmount - calculatedAmount
      const differencePercentage = calculatedAmount > 0 
        ? (difference / calculatedAmount) * 100 
        : 0

      // Calcular inicio y fin usando las fechas reales de las entradas
      const dates = week.entries.map(e => new Date(e.date).getTime())
      const minDate = new Date(Math.min(...dates))
      
      // Ajustar al lunes de la semana para minDate
      const startDay = minDate.getDay()
      const diffToMonday = startDay === 0 ? -6 : 1 - startDay
      const start = new Date(minDate)
      start.setDate(minDate.getDate() + diffToMonday)
      start.setHours(0, 0, 0, 0)
      
      // El fin es el domingo (6 días después del lunes)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)

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
