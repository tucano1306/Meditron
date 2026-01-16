import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { HOURLY_RATE } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Obtener resúmenes mensuales
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (year && month) {
      // Obtener resumen de un mes específico
      const summary = await prisma.monthSummary.findUnique({
        where: {
          year_month_userId: {
            year: Number.parseInt(year, 10),
            month: Number.parseInt(month, 10),
            userId
          }
        }
      })

      // También obtener las semanas del mes
      const weeks = await prisma.week.findMany({
        where: {
          year: Number.parseInt(year, 10),
          month: Number.parseInt(month, 10),
          userId
        },
        include: {
          entries: true
        },
        orderBy: {
          weekNumber: 'asc'
        }
      })

      // Calcular totales por día
      const dailyTotals: Record<string, number> = {}
      for (const week of weeks) {
        for (const entry of week.entries) {
          if (entry.duration) {
            const dateKey = new Date(entry.date).toISOString().split('T')[0]
            dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + entry.duration
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          summary,
          weeks,
          dailyTotals,
          hourlyRate: HOURLY_RATE
        }
      })
    }

    // Obtener todos los resúmenes
    const summaries = await prisma.monthSummary.findMany({
      where: { userId },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: summaries
    })
  } catch (error) {
    console.error('Error getting month summaries:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener resúmenes mensuales' },
      { status: 500 }
    )
  }
}
