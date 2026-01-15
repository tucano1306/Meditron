import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateWeek, updateWeekTotals, updateMonthSummary } from '@/lib/week-utils'

// GET - Obtener entradas de tiempo
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekId = searchParams.get('weekId')
    const date = searchParams.get('date')

    const where: Record<string, unknown> = {}

    if (weekId) {
      where.weekId = weekId
    }

    if (date) {
      where.date = new Date(date)
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        week: true
      },
      orderBy: {
        startTime: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: entries
    })
  } catch (error) {
    console.error('Error getting entries:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener entradas' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar entrada
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      )
    }

    await prisma.timeEntry.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      data: { message: 'Entrada eliminada' }
    })
  } catch (error) {
    console.error('Error deleting entry:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar entrada' },
      { status: 500 }
    )
  }
}

// POST - Crear entrada manual (desde calculadora)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hours, minutes, payment, hourlyRate } = body

    if (hours === undefined || minutes === undefined || payment === undefined) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    const totalSeconds = (Number(hours) * 3600) + (Number(minutes) * 60)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Calcular hora de inicio basada en la duración (como si hubiera terminado ahora)
    const startTime = new Date(now.getTime() - totalSeconds * 1000)

    // Obtener o crear semana
    const week = await getOrCreateWeek(today)

    // Crear la entrada
    const entry = await prisma.timeEntry.create({
      data: {
        startTime,
        endTime: now,
        duration: totalSeconds,
        date: today,
        weekId: week.id
      }
    })

    // Actualizar totales
    await updateWeekTotals(week.id)
    await updateMonthSummary(today.getFullYear(), today.getMonth() + 1)

    return NextResponse.json({
      success: true,
      data: {
        entry,
        totalHours: totalSeconds / 3600,
        payment: Number(payment),
        hourlyRate: Number(hourlyRate)
      }
    })
  } catch (error) {
    console.error('Error creating manual entry:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear entrada' },
      { status: 500 }
    )
  }
}
