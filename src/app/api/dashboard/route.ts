import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { HOURLY_RATE, getWeekStartEnd, getWeekNumber, getFloridaDateComponents } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Dashboard con datos actuales
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const userHourlyRate = authResult.user.hourlyRate ?? HOURLY_RATE
    
    // Usar timestamp real y calcular componentes de Florida directamente
    // IMPORTANTE: No usar getFloridaDate() + getWeekNumber() porque causa doble conversión
    const realNow = new Date()
    const floridaComponents = getFloridaDateComponents(realNow)
    const year = floridaComponents.year
    const month = floridaComponents.month
    const { start: weekStart, end: weekEnd } = getWeekStartEnd(realNow)
    const weekNumber = getWeekNumber(realNow)

    // Timer activo
    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        endTime: null,
        userId
      }
    })

    // Semana actual
    const currentWeek = await prisma.week.findUnique({
      where: {
        weekNumber_year_userId: {
          weekNumber,
          year,
          userId
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
        year_month_userId: {
          year,
          month,
          userId
        }
      }
    })

    // Entradas de hoy - usar componentes de Florida para UTC midnight
    const todayLocal = new Date(Date.UTC(floridaComponents.year, floridaComponents.month - 1, floridaComponents.day))
    const tomorrowLocal = new Date(Date.UTC(floridaComponents.year, floridaComponents.month - 1, floridaComponents.day + 1))

    const todayEntries = await prisma.timeEntry.findMany({
      where: {
        date: {
          gte: todayLocal,
          lt: tomorrowLocal
        },
        userId
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
    const todayEarnings = todayHours * userHourlyRate

    // Estado del timer
    let timerState = {
      isRunning: false,
      startTime: null as string | null,
      currentEntryId: null as string | null,
      elapsedSeconds: 0
    }

    if (activeEntry) {
      // Usar timestamp real para calcular elapsed time
      timerState = {
        isRunning: true,
        startTime: activeEntry.startTime.toISOString(),
        currentEntryId: activeEntry.id,
        elapsedSeconds: Math.max(0, Math.floor(
          (realNow.getTime() - new Date(activeEntry.startTime).getTime()) / 1000
        ))
      }
    }

    // Componentes de fecha en Florida ya calculados arriba
    const todayDateString = `${floridaComponents.year}-${String(floridaComponents.month).padStart(2, '0')}-${String(floridaComponents.day).padStart(2, '0')}`

    return NextResponse.json({
      success: true,
      data: {
        timerState,
        today: {
          date: todayDateString,
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
        hourlyRate: userHourlyRate
      }
    })
  } catch (error) {
    console.error('Error getting dashboard:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: 'Error al obtener dashboard', details: errorMessage },
      { status: 500 }
    )
  }
}

// PATCH - Actualizar hourlyRate del usuario
export async function PATCH(request: Request) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { hourlyRate } = body

    if (typeof hourlyRate !== 'number' || hourlyRate <= 0) {
      return NextResponse.json(
        { success: false, error: 'Tarifa inválida' },
        { status: 400 }
      )
    }

    const updatedUser = await prisma.user.update({
      where: { id: authResult.user.id },
      data: { hourlyRate },
      select: { hourlyRate: true }
    })

    return NextResponse.json({
      success: true,
      data: { hourlyRate: updatedUser.hourlyRate }
    })
  } catch (error) {
    console.error('Error updating hourly rate:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: 'Error al actualizar tarifa', details: errorMessage },
      { status: 500 }
    )
  }
}
