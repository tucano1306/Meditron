import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getOrCreateWeek, updateWeekTotals, updateMonthSummary } from '@/lib/week-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST - Iniciar timer
export async function POST() {
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
    
    // Verificar si hay un timer activo para este usuario
    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        endTime: null,
        userId
      }
    })

    if (activeEntry) {
      return NextResponse.json(
        { success: false, error: 'Ya hay un timer activo' },
        { status: 400 }
      )
    }

    // Obtener o crear la semana actual
    const week = await getOrCreateWeek(now, userId)

    // Crear nueva entrada de tiempo
    const entry = await prisma.timeEntry.create({
      data: {
        startTime: now,
        date: new Date(now.toISOString().split('T')[0]),
        weekId: week.id,
        userId
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        entry,
        message: 'Timer iniciado'
      }
    })
  } catch (error) {
    console.error('Error starting timer:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: 'Error al iniciar el timer', details: errorMessage },
      { status: 500 }
    )
  }
}

// PUT - Detener timer
export async function PUT() {
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

    // Buscar timer activo del usuario
    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        endTime: null,
        userId
      },
      include: {
        week: true
      }
    })

    if (!activeEntry) {
      return NextResponse.json(
        { success: false, error: 'No hay timer activo' },
        { status: 400 }
      )
    }

    // Calcular duración en segundos
    const duration = Math.floor(
      (now.getTime() - new Date(activeEntry.startTime).getTime()) / 1000
    )

    // Actualizar entrada
    const updatedEntry = await prisma.timeEntry.update({
      where: { id: activeEntry.id },
      data: {
        endTime: now,
        duration
      }
    })

    // Actualizar totales de la semana
    const weekTotals = await updateWeekTotals(activeEntry.weekId, userId)

    // Actualizar resumen mensual
    const monthTotals = await updateMonthSummary(
      activeEntry.week.year,
      activeEntry.week.month,
      userId
    )

    return NextResponse.json({
      success: true,
      data: {
        entry: updatedEntry,
        weekTotals,
        monthTotals,
        message: 'Timer detenido'
      }
    })
  } catch (error) {
    console.error('Error stopping timer:', error)
    return NextResponse.json(
      { success: false, error: 'Error al detener el timer' },
      { status: 500 }
    )
  }
}

// GET - Obtener estado actual del timer
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

    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        endTime: null,
        userId
      }
    })

    if (activeEntry) {
      const elapsedSeconds = Math.floor(
        (Date.now() - new Date(activeEntry.startTime).getTime()) / 1000
      )

      return NextResponse.json({
        success: true,
        data: {
          isRunning: true,
          startTime: activeEntry.startTime,
          currentEntryId: activeEntry.id,
          elapsedSeconds
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        isRunning: false,
        startTime: null,
        currentEntryId: null,
        elapsedSeconds: 0
      }
    })
  } catch (error) {
    console.error('Error getting timer status:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener estado del timer' },
      { status: 500 }
    )
  }
}
