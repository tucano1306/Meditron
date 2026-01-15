import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// POST - Iniciar trabajo por pago
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

    // Crear nueva entrada de pago
    const entry = await prisma.paymentEntry.create({
      data: {
        startTime: now,
        date: new Date(now.toISOString().split('T')[0]),
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
    return NextResponse.json(
      { success: false, error: 'Error al iniciar el trabajo' },
      { status: 500 }
    )
  }
}

// PUT - Detener trabajo y registrar pago
export async function PUT(request: Request) {
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
    const { amount } = await request.json()

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
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const userId = session.user.id

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
