import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getFloridaDate, getFloridaDateComponents } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Dashboard de pagos
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    // Usar hora de Florida para determinar "hoy" y "mes"
    const floridaNow = getFloridaDate()
    const floridaComponents = getFloridaDateComponents(new Date())

    // Trabajo activo
    const activeEntry = await prisma.paymentEntry.findFirst({
      where: {
        completed: false,
        userId
      }
    })

    // Entradas de hoy (usando hora de Florida para determinar el día)
    const todayStart = new Date(floridaNow.getFullYear(), floridaNow.getMonth(), floridaNow.getDate(), 0, 0, 0, 0)
    const todayEnd = new Date(floridaNow.getFullYear(), floridaNow.getMonth(), floridaNow.getDate(), 23, 59, 59, 999)

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
    const thirtyDaysAgo = new Date(floridaNow)
    thirtyDaysAgo.setDate(floridaNow.getDate() - 30)

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
    const monthStart = new Date(floridaNow.getFullYear(), floridaNow.getMonth(), 1)
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
      // Usar timestamp real para calcular elapsed time (no getFloridaDate)
      const realNow = new Date()
      timerState = {
        isRunning: true,
        startTime: activeEntry.startTime.toISOString(),
        currentEntryId: activeEntry.id,
        elapsedSeconds: Math.max(0, Math.floor(
          (realNow.getTime() - new Date(activeEntry.startTime).getTime()) / 1000
        ))
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        timerState,
        today: {
          date: `${floridaComponents.year}-${String(floridaComponents.month).padStart(2, '0')}-${String(floridaComponents.day).padStart(2, '0')}`,
          entries: todayEntries,
          totalSeconds: todayStats.totalDuration,
          totalHours: todayStats.totalDuration / 3600,
          totalAmount: todayStats.totalAmount,
          avgHourlyRate,
          jobCount: todayStats.count
        },
        month: {
          year: floridaNow.getFullYear(),
          month: floridaNow.getMonth() + 1,
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
