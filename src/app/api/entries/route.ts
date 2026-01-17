import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getOrCreateWeek, updateWeekTotals, updateMonthSummary } from '@/lib/week-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Obtener entradas de tiempo
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const { searchParams } = new URL(request.url)
    const weekId = searchParams.get('weekId')
    const date = searchParams.get('date')

    const where: Record<string, unknown> = { userId }

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
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      )
    }

    // Verificar que la entrada pertenece al usuario
    const entry = await prisma.timeEntry.findFirst({
      where: { id, userId }
    })

    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entrada no encontrada' },
        { status: 404 }
      )
    }

    // Guardar weekId y fecha antes de borrar
    const weekId = entry.weekId
    const entryDate = new Date(entry.date)

    await prisma.timeEntry.delete({
      where: { id }
    })

    // Actualizar totales de semana y mes después de borrar
    if (weekId) {
      await updateWeekTotals(weekId, userId)
    }
    await updateMonthSummary(entryDate.getFullYear(), entryDate.getMonth() + 1, userId)

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
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const body = await request.json()
    const { hours, minutes, payment, hourlyRate, date } = body

    if (hours === undefined || minutes === undefined || payment === undefined) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    const totalSeconds = (Number(hours) * 3600) + (Number(minutes) * 60)
    
    // Si se proporciona una fecha, usarla; si no, usar hoy
    let targetDate: Date
    if (date) {
      // Parsear la fecha en formato YYYY-MM-DD
      const [year, month, day] = date.split('-').map(Number)
      targetDate = new Date(year, month - 1, day)
    } else {
      const now = new Date()
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }
    
    // Crear tiempos de inicio y fin para la fecha seleccionada
    // Ponemos el fin a las 18:00 de ese día y el inicio según la duración
    const endTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 18, 0, 0)
    const startTime = new Date(endTime.getTime() - totalSeconds * 1000)

    // Obtener o crear semana
    const week = await getOrCreateWeek(targetDate, userId)

    // Crear la entrada
    const entry = await prisma.timeEntry.create({
      data: {
        startTime,
        endTime,
        duration: totalSeconds,
        date: targetDate,
        weekId: week.id,
        userId
      }
    })

    // Actualizar totales
    await updateWeekTotals(week.id, userId)
    await updateMonthSummary(targetDate.getFullYear(), targetDate.getMonth() + 1, userId)

    return NextResponse.json({
      success: true,
      data: {
        entry,
        totalHours: totalSeconds / 3600,
        payment: Number(payment),
        hourlyRate: Number(hourlyRate),
        date: targetDate.toISOString()
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

// PATCH - Actualizar entrada existente
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      )
    }

    // Verificar que la entrada pertenece al usuario
    const entry = await prisma.timeEntry.findFirst({
      where: { id, userId }
    })

    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entrada no encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { startTime, endTime } = body

    if (!startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'startTime y endTime son requeridos' },
        { status: 400 }
      )
    }

    const newStart = new Date(startTime)
    const newEnd = new Date(endTime)
    const duration = Math.floor((newEnd.getTime() - newStart.getTime()) / 1000)

    if (duration <= 0) {
      return NextResponse.json(
        { success: false, error: 'El tiempo de fin debe ser posterior al inicio' },
        { status: 400 }
      )
    }

    // Usar la fecha del startTime para la fecha de la entrada (fecha local)
    const entryDate = new Date(newStart.getFullYear(), newStart.getMonth(), newStart.getDate())

    const updatedEntry = await prisma.timeEntry.update({
      where: { id },
      data: {
        startTime: newStart,
        endTime: newEnd,
        duration,
        date: entryDate
      }
    })

    // Actualizar totales de semana y mes
    if (entry.weekId) {
      await updateWeekTotals(entry.weekId, userId)
    }
    await updateMonthSummary(newStart.getFullYear(), newStart.getMonth() + 1, userId)

    return NextResponse.json({
      success: true,
      data: updatedEntry
    })
  } catch (error) {
    console.error('Error updating entry:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar entrada' },
      { status: 500 }
    )
  }
}
