import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getOrCreateWeek, updateWeekTotals, updateMonthSummary } from '@/lib/week-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST - Iniciar timer
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    
    // Obtener la hora del cliente si se envía
    let now: Date
    try {
      const body = await request.json()
      now = body.clientTime ? new Date(body.clientTime) : new Date()
    } catch {
      now = new Date()
    }
    
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

    // Crear fecha local basada en la hora del cliente
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Crear nueva entrada de tiempo
    const entry = await prisma.timeEntry.create({
      data: {
        startTime: now,
        date: localDate,
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
export async function PUT(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    
    // Obtener la hora del cliente y jobNumber si se envía
    let now: Date
    let jobNumber: string | undefined
    try {
      const body = await request.json()
      now = body.clientTime ? new Date(body.clientTime) : new Date()
      jobNumber = body.jobNumber
    } catch {
      now = new Date()
    }

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
        duration,
        jobNumber: jobNumber || activeEntry.jobNumber
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
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id

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
          jobNumber: activeEntry.jobNumber,
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

// PATCH - Actualizar jobNumber del timer en curso
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const body = await request.json()
    const { jobNumber } = body

    // Buscar timer activo
    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        endTime: null,
        userId
      }
    })

    if (!activeEntry) {
      return NextResponse.json(
        { success: false, error: 'No hay timer activo' },
        { status: 400 }
      )
    }

    // Actualizar jobNumber
    const updatedEntry = await prisma.timeEntry.update({
      where: { id: activeEntry.id },
      data: { jobNumber }
    })

    return NextResponse.json({
      success: true,
      data: {
        entry: updatedEntry,
        message: 'Número de trabajo actualizado'
      }
    })
  } catch (error) {
    console.error('Error updating job number:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar número de trabajo' },
      { status: 500 }
    )
  }
}
