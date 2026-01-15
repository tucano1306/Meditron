import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// GET - Dashboard de pagos
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
    const now = new Date()

    // Trabajo activo
    const activeEntry = await prisma.paymentEntry.findFirst({
      where: {
        completed: false,
        userId
      }
    })

    // Entradas de hoy
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const todayEntries = await prisma.paymentEntry.findMany({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd
        },
        userId,
        completed: true
      },
      orderBy: {
        startTime: 'desc'
      }
    })

    // Estadísticas de hoy
    const todayStats = todayEntries.reduce(
      (acc: { totalDuration: number; totalAmount: number; count: number }, entry: { duration: number | null; amount: number | null }) => ({
        totalDuration: acc.totalDuration + (entry.duration ?? 0),
        totalAmount: acc.totalAmount + (entry.amount ?? 0),
        count: acc.count + 1
      }),
      { totalDuration: 0, totalAmount: 0, count: 0 }
    )

    // Calcular tarifa promedio por hora
    const avgHourlyRate = todayStats.totalDuration > 0
      ? todayStats.totalAmount / (todayStats.totalDuration / 3600)
      : 0

    // Historial reciente (últimos 30 días)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)

    const recentEntries = await prisma.paymentEntry.findMany({
      where: {
        userId,
        completed: true,
        date: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: {
        startTime: 'desc'
      },
      take: 50
    })

    // Estadísticas del mes
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEntries = await prisma.paymentEntry.findMany({
      where: {
        userId,
        completed: true,
        date: {
          gte: monthStart
        }
      }
    })

    const monthStats = monthEntries.reduce(
      (acc: { totalDuration: number; totalAmount: number; count: number }, entry: { duration: number | null; amount: number | null }) => ({
        totalDuration: acc.totalDuration + (entry.duration ?? 0),
        totalAmount: acc.totalAmount + (entry.amount ?? 0),
        count: acc.count + 1
      }),
      { totalDuration: 0, totalAmount: 0, count: 0 }
    )

    const monthAvgHourlyRate = monthStats.totalDuration > 0
      ? monthStats.totalAmount / (monthStats.totalDuration / 3600)
      : 0

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
          totalSeconds: todayStats.totalDuration,
          totalHours: todayStats.totalDuration / 3600,
          totalAmount: todayStats.totalAmount,
          avgHourlyRate,
          jobCount: todayStats.count
        },
        month: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          totalSeconds: monthStats.totalDuration,
          totalHours: monthStats.totalDuration / 3600,
          totalAmount: monthStats.totalAmount,
          avgHourlyRate: monthAvgHourlyRate,
          jobCount: monthStats.count
        },
        recentEntries
      }
    })
  } catch (error) {
    console.error('Error getting payment dashboard:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: 'Error al obtener dashboard', details: errorMessage },
      { status: 500 }
    )
  }
}
