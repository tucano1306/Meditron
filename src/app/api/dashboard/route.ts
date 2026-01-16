import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { HOURLY_RATE, getWeekStartEnd, getWeekNumber } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Dashboard con datos actuales
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    
    // Obtener el usuario para su hourlyRate
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hourlyRate: true }
    })
    const userHourlyRate = user?.hourlyRate ?? HOURLY_RATE
    
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const { start: weekStart, end: weekEnd } = getWeekStartEnd(now)
    const weekNumber = getWeekNumber(now)

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
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
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
      where: { id: session.user.id },
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
