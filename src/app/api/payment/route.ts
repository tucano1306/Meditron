import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { parseClientDateTime, getFloridaDate } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST - Iniciar trabajo por pago
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    
    // Obtener la hora del cliente si se envía, sino usar hora de Florida
    let now: Date
    try {
      const body = await request.json()
      now = body.clientTime ? parseClientDateTime(body.clientTime) : getFloridaDate()
    } catch {
      now = getFloridaDate()
    }

    // Verificar si hay un trabajo activo
    const activeEntry = await prisma.paymentEntry.findFirst({
      where: {
        completed: false,
        userId
      }
    })

    if (activeEntry) {
      return NextResponse.json(
        { success: false, error: 'Ya hay un trabajo en progreso' },
        { status: 400 }
      )
    }

    // Crear fecha local basada en la hora del cliente
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Obtener jobNumber si se envía
    let jobNumber: string | undefined
    try {
      const body = await request.clone().json()
      jobNumber = body.jobNumber
    } catch {
      // No body or no jobNumber
    }

    // Crear nueva entrada de pago
    const entry = await prisma.paymentEntry.create({
      data: {
        startTime: now,
        date: localDate,
        jobNumber: jobNumber || null,
        userId
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        entry,
        message: 'Trabajo iniciado'
      }
    })
  } catch (error) {
    console.error('Error starting payment entry:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: 'Error al iniciar el trabajo', details: errorMessage },
      { status: 500 }
    )
  }
}

// PUT - Detener trabajo y registrar pago
export async function PUT(request: Request) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const body = await request.json()
    const { amount, clientTime, jobNumber } = body
    
    // Usar la hora local del cliente si se envía, sino usar hora de Florida
    const now = clientTime ? parseClientDateTime(clientTime) : getFloridaDate()

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Monto inválido' },
        { status: 400 }
      )
    }

    // Buscar trabajo activo
    const activeEntry = await prisma.paymentEntry.findFirst({
      where: {
        completed: false,
        userId
      }
    })

    if (!activeEntry) {
      return NextResponse.json(
        { success: false, error: 'No hay trabajo en progreso' },
        { status: 400 }
      )
    }

    // Calcular duración y tarifa por hora
    const duration = Math.floor(
      (now.getTime() - new Date(activeEntry.startTime).getTime()) / 1000
    )
    const hours = duration / 3600
    const hourlyRate = hours > 0 ? amount / hours : 0

    // Actualizar entrada
    const updatedEntry = await prisma.paymentEntry.update({
      where: { id: activeEntry.id },
      data: {
        endTime: now,
        duration,
        amount,
        hourlyRate,
        jobNumber: jobNumber || activeEntry.jobNumber,
        completed: true
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        entry: updatedEntry,
        calculatedHourlyRate: hourlyRate,
        message: 'Trabajo completado'
      }
    })
  } catch (error) {
    console.error('Error stopping payment entry:', error)
    return NextResponse.json(
      { success: false, error: 'Error al completar el trabajo' },
      { status: 500 }
    )
  }
}

// GET - Estado actual del trabajo
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id

    const activeEntry = await prisma.paymentEntry.findFirst({
      where: {
        completed: false,
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
    console.error('Error getting payment status:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener estado' },
      { status: 500 }
    )
  }
}

// PATCH - Actualizar jobNumber del trabajo en curso
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const body = await request.json()

    // Si hay ID, es una edición completa de entrada existente
    if (id) {
      const { startTime, endTime, amount, jobNumber } = body

      // Verificar que la entrada pertenece al usuario
      const entry = await prisma.paymentEntry.findFirst({
        where: { id, userId }
      })

      if (!entry) {
        return NextResponse.json(
          { success: false, error: 'Entrada no encontrada' },
          { status: 404 }
        )
      }

      if (!startTime || !endTime || amount === undefined) {
        return NextResponse.json(
          { success: false, error: 'startTime, endTime y amount son requeridos' },
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

      const hours = duration / 3600
      const hourlyRate = hours > 0 ? Number(amount) / hours : 0

      const updatedEntry = await prisma.paymentEntry.update({
        where: { id },
        data: {
          startTime: newStart,
          endTime: newEnd,
          duration,
          amount: Number(amount),
          hourlyRate,
          jobNumber: jobNumber === undefined ? entry.jobNumber : jobNumber
        }
      })

      return NextResponse.json({
        success: true,
        data: updatedEntry
      })
    }

    // Sin ID, actualizar solo jobNumber del trabajo activo
    const { jobNumber } = body

    // Buscar trabajo activo
    const activeEntry = await prisma.paymentEntry.findFirst({
      where: {
        completed: false,
        userId
      }
    })

    if (!activeEntry) {
      return NextResponse.json(
        { success: false, error: 'No hay trabajo en progreso' },
        { status: 400 }
      )
    }

    // Actualizar jobNumber
    const updatedEntry = await prisma.paymentEntry.update({
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
    console.error('Error updating payment entry:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar entrada' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar entrada de pago
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
    const entry = await prisma.paymentEntry.findFirst({
      where: { id, userId }
    })

    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entrada no encontrada' },
        { status: 404 }
      )
    }

    await prisma.paymentEntry.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      data: { message: 'Entrada eliminada' }
    })
  } catch (error) {
    console.error('Error deleting payment entry:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar entrada' },
      { status: 500 }
    )
  }
}
