import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  return Math.ceil((days + startOfYear.getDay() + 1) / 7)
}

// POST - Actualizar pago de compañía para una semana
export async function POST(request: Request) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const { weekNumber, year, companyPaid } = await request.json()

    if (!weekNumber || !year || companyPaid === undefined) {
      return NextResponse.json(
        { success: false, error: 'weekNumber, year y companyPaid son requeridos' },
        { status: 400 }
      )
    }

    if (typeof companyPaid !== 'number' || companyPaid < 0) {
      return NextResponse.json(
        { success: false, error: 'companyPaid debe ser un número positivo' },
        { status: 400 }
      )
    }

    // Obtener todas las entradas del usuario
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId,
        endTime: { not: null }
      }
    })

    // Filtrar entradas por semana
    const weekEntries = entries.filter(entry => {
      const date = new Date(entry.date)
      const entryWeek = getWeekNumber(date)
      const entryYear = date.getFullYear()
      return entryWeek === weekNumber && entryYear === year
    })

    if (weekEntries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron trabajos para esta semana' },
        { status: 404 }
      )
    }

    // Distribuir el pago de la compañía proporcionalmente entre los trabajos
    const totalCalculated = weekEntries.reduce((sum, e) => sum + (e.calculatedAmount || 0), 0)
    const now = new Date()

    // Actualizar cada entrada con su porción del pago
    const updatePromises = weekEntries.map(entry => {
      const proportion = totalCalculated > 0 ? (entry.calculatedAmount || 0) / totalCalculated : 1 / weekEntries.length
      const entryCompanyPaid = companyPaid * proportion

      return prisma.timeEntry.update({
        where: { id: entry.id },
        data: {
          companyPaid: entryCompanyPaid,
          companyPaidDate: now
        }
      })
    })

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: weekEntries.length,
        totalCompanyPaid: companyPaid
      }
    })
  } catch (error) {
    console.error('Error updating company payment:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar el pago de la compañía' },
      { status: 500 }
    )
  }
}
