import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { HOURLY_RATE } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Obtener semanas
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    const where: Record<string, unknown> = { userId }

    if (year) {
      where.year = Number.parseInt(year, 10)
    }

    if (month) {
      where.month = Number.parseInt(month, 10)
    }

    const weeks = await prisma.week.findMany({
      where,
      include: {
        entries: {
          orderBy: {
            startTime: 'desc'
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { weekNumber: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: weeks
    })
  } catch (error) {
    console.error('Error getting weeks:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener semanas' },
      { status: 500 }
    )
  }
}

// POST - Recalcular todos los totales y limpiar datos huérfanos
export async function POST() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id

    // Obtener todas las semanas del usuario
    const weeks = await prisma.week.findMany({
      where: { userId },
      include: { entries: true }
    })

    let weeksUpdated = 0
    let weeksDeleted = 0
    const monthsToUpdate = new Set<string>()

    for (const week of weeks) {
      // Recalcular totales desde las entradas
      const totalSeconds = week.entries.reduce((sum, e) => sum + (e.duration || 0), 0)
      const totalHours = totalSeconds / 3600
      const earnings = totalHours * HOURLY_RATE

      if (week.entries.length === 0 && totalHours === 0) {
        // Borrar semana vacía
        await prisma.week.delete({ where: { id: week.id } })
        weeksDeleted++
      } else {
        // Actualizar totales
        await prisma.week.update({
          where: { id: week.id },
          data: { totalHours, earnings }
        })
        weeksUpdated++
      }

      monthsToUpdate.add(`${week.year}-${week.month}`)
    }

    // Recalcular resúmenes mensuales
    for (const monthKey of monthsToUpdate) {
      const [year, month] = monthKey.split('-').map(Number)
      
      const monthWeeks = await prisma.week.findMany({
        where: { year, month, userId }
      })

      const totalHours = monthWeeks.reduce((sum, w) => sum + w.totalHours, 0)
      const earnings = totalHours * HOURLY_RATE

      if (monthWeeks.length === 0 || totalHours === 0) {
        // Borrar resumen mensual vacío
        await prisma.monthSummary.deleteMany({
          where: { year, month, userId }
        })
      } else {
        await prisma.monthSummary.upsert({
          where: { year_month_userId: { year, month, userId } },
          update: { totalHours, earnings },
          create: { year, month, totalHours, earnings, userId }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Datos recalculados',
        weeksUpdated,
        weeksDeleted,
        monthsRecalculated: monthsToUpdate.size
      }
    })
  } catch (error) {
    console.error('Error recalculating data:', error)
    return NextResponse.json(
      { success: false, error: 'Error al recalcular datos' },
      { status: 500 }
    )
  }
}
