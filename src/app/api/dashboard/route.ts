import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { HOURLY_RATE, getWeekStartEnd, getWeekNumber } from '@/lib/utils'

// GET - Dashboard con datos actuales
export async function GET() {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const { start: weekStart, end: weekEnd } = getWeekStartEnd(now)
    const weekNumber = getWeekNumber(now)

    // Timer activo
    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        endTime: null
      }
    })

    // Semana actual
    const currentWeek = await prisma.week.findUnique({
      where: {
        weekNumber_year: {
          weekNumber,
          year
        }
      },
      include: {
        entries: {
          orderBy: {
            startTime: 'desc'
          }
        }
      }
    })

    // Resumen del mes actual
    const monthSummary = await prisma.monthSummary.findUnique({
      where: {
        year_month: {
          year,
          month
        }
      }
    })

    // Entradas de hoy
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const todayEntries = await prisma.timeEntry.findMany({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd
        }
      },
      orderBy: {
        startTime: 'desc'
      }
    })

    // Calcular totales de hoy
    const todayTotalSeconds = todayEntries.reduce(
      (sum: number, entry: { duration: number | null }) => sum + (entry.duration || 0),
      0
    )
    const todayHours = todayTotalSeconds / 3600
    const todayEarnings = todayHours * HOURLY_RATE

    // Estado del timer
    let timerState = {
      isRunning: false,
      startTime: null as string | null,
      currentEntryId: null as string | null,
      elapsedSeconds: 0
    }

    if (activeEntry) {
      timerState = {
        isRunning: true,
        startTime: activeEntry.startTime.toISOString(),
        currentEntryId: activeEntry.id,
        elapsedSeconds: Math.floor(
          (now.getTime() - new Date(activeEntry.startTime).getTime()) / 1000
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        timerState,
        today: {
          date: now.toISOString().split('T')[0],
          entries: todayEntries,
          totalSeconds: todayTotalSeconds,
          totalHours: todayHours,
          earnings: todayEarnings
        },
        currentWeek: currentWeek ?? {
          weekNumber,
          year,
          month,
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
          totalHours: 0,
          earnings: 0,
          entries: []
        },
        monthSummary: monthSummary ?? {
          year,
          month,
          totalHours: 0,
          earnings: 0
        },
        hourlyRate: HOURLY_RATE
      }
    })
  } catch (error) {
    console.error('Error getting dashboard:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener dashboard' },
      { status: 500 }
    )
  }
}
