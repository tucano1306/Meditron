import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { clientNow, parseClientDateTime, getFloridaDateComponents } from '@/lib/utils'
import { checkStartTime, lastPaymentEndTime } from '@/lib/timer-start'
import { parseJobInput, serializeJob, withDerivedFields } from '@/lib/payment-store'

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
    
    // Obtener la hora del cliente (UTC) si se envía, sino usar hora actual UTC
    let now = new Date()
    let requestedStart: Date | null = null
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
      now = clientNow(body.clientTime)
      // Se olvidó iniciar el cronómetro: empieza desde una hora anterior
      if (body.startTime) requestedStart = parseClientDateTime(String(body.startTime))
    } catch {
      // Sin body: empieza ahora
    }
    const start = parseJobInput({ jobNumber: body.jobNumber }, true)
    if (!start.ok) {
      return NextResponse.json({ success: false, error: start.error }, { status: 400 })
    }

    if (requestedStart) {
      const startError = checkStartTime(requestedStart, await lastPaymentEndTime(userId))
      if (startError) {
        return NextResponse.json({ success: false, error: startError }, { status: 400 })
      }
      now = requestedStart
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

    // Crear fecha basada en zona horaria de Florida (para agrupar por día)
    const floridaComponents = getFloridaDateComponents(now)
    const localDate = new Date(Date.UTC(floridaComponents.year, floridaComponents.month - 1, floridaComponents.day))

    // Crear nueva entrada de pago (startTime en UTC)
    const entry = await prisma.paymentEntry.create({
      data: {
        startTime: now,
        date: localDate,
        jobNumber: (start.value.jobNumber as string | null | undefined) ?? null,
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
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const body = await request.json()

    // Usar la hora UTC del cliente si se envía, sino usar hora actual UTC
    const now = clientNow(body.clientTime)

    if (typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Monto inválido' },
        { status: 400 }
      )
    }

    // Detalles del trabajo al terminarlo: pago, propina, cliente, notas, método y si ya se cobró
    const details = parseJobInput({
      amount: body.amount,
      jobNumber: body.jobNumber,
      vehicle: body.vehicle,
      tip: body.tip,
      client: body.client,
      notes: body.notes,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus ?? 'paid',
    }, true)
    if (!details.ok) {
      return NextResponse.json({ success: false, error: details.error }, { status: 400 })
    }
    const amount = details.value.amount as number
    const jobNumber = details.value.jobNumber as string | null | undefined
    const vehicle = details.value.vehicle as string | null | undefined

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

    // Calcular la fecha correcta basada en la hora de FIN en Florida
    // Esto asegura que si terminas a las 2am del día 2, la fecha sea del día 2
    const floridaEndComponents = getFloridaDateComponents(now)
    const correctDate = new Date(Date.UTC(floridaEndComponents.year, floridaEndComponents.month - 1, floridaEndComponents.day))

    // Actualizar entrada
    const updatedEntry = await prisma.paymentEntry.update({
      where: { id: activeEntry.id },
      data: {
        ...withDerivedFields(details.value, null),
        endTime: now,
        duration,
        amount,
        hourlyRate,
        jobNumber: jobNumber || activeEntry.jobNumber,
        vehicle: vehicle || activeEntry.vehicle,
        date: correctDate,
        completed: true
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        entry: updatedEntry,
        job: serializeJob(updatedEntry),
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
      // Usar timestamp real para calcular elapsed time correctamente
      // (no usar getFloridaDate() aquí porque esa fecha tiene timestamp alterado)
      const now = new Date()
      const startTime = new Date(activeEntry.startTime)
      const elapsedSeconds = Math.floor(
        (now.getTime() - startTime.getTime()) / 1000
      )

      return NextResponse.json({
        success: true,
        data: {
          isRunning: true,
          startTime: activeEntry.startTime,
          currentEntryId: activeEntry.id,
          jobNumber: activeEntry.jobNumber,
          vehicle: activeEntry.vehicle,
          client: activeEntry.client,
          notes: activeEntry.notes,
          elapsedSeconds: Math.max(0, elapsedSeconds),
          lastEndTime: await lastPaymentEndTime(userId, activeEntry.id)
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        isRunning: false,
        startTime: null,
        currentEntryId: null,
        elapsedSeconds: 0,
        lastEndTime: await lastPaymentEndTime(userId)
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

// Helper: Corregir la hora de inicio del trabajo activo (p. ej. se inició tarde)
async function handleActiveStartUpdate(userId: string, startTime: unknown) {
  const activeEntry = await prisma.paymentEntry.findFirst({
    where: { completed: false, userId }
  })
  if (!activeEntry) {
    return NextResponse.json({ success: false, error: 'No hay trabajo en progreso' }, { status: 400 })
  }

  const newStart = parseClientDateTime(String(startTime ?? ''))
  const startError = checkStartTime(newStart, await lastPaymentEndTime(userId, activeEntry.id))
  if (startError) {
    return NextResponse.json({ success: false, error: startError }, { status: 400 })
  }

  const updatedEntry = await prisma.paymentEntry.update({
    where: { id: activeEntry.id },
    data: { startTime: newStart }
  })
  return NextResponse.json({
    success: true,
    data: {
      entry: updatedEntry,
      startTime: updatedEntry.startTime,
      elapsedSeconds: Math.max(0, Math.floor((Date.now() - newStart.getTime()) / 1000))
    }
  })
}

// Helper: Actualizar trabajo activo (jobNumber/vehicle)
async function handleActiveEntryUpdate(userId: string, body: Record<string, unknown>) {
  const details = parseJobInput({ jobNumber: body.jobNumber, vehicle: body.vehicle, client: body.client, notes: body.notes }, true)
  if (!details.ok) {
    return NextResponse.json({ success: false, error: details.error }, { status: 400 })
  }

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

  // Solo los campos que vinieron (parseJobInput ya los validó)
  const updateData: { jobNumber?: string | null; vehicle?: string | null; client?: string | null; notes?: string | null } = {}
  if (body.jobNumber !== undefined) updateData.jobNumber = details.value.jobNumber as string | null
  if (body.vehicle !== undefined) updateData.vehicle = details.value.vehicle as string | null
  if (body.client !== undefined) updateData.client = details.value.client as string | null
  if (body.notes !== undefined) updateData.notes = details.value.notes as string | null
  
  const updatedEntry = await prisma.paymentEntry.update({
    where: { id: activeEntry.id },
    data: updateData
  })

  return NextResponse.json({
    success: true,
    data: {
      entry: updatedEntry,
      message: 'Trabajo actualizado'
    }
  })
}

// PATCH - Actualizar entrada de pago
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const body = await request.json()

    // Trabajo en curso: ajustar el inicio o actualizar sus datos.
    // Los trabajos terminados se editan en /api/payment/jobs/[id]
    if (body.action === 'setStart') {
      return handleActiveStartUpdate(userId, body.startTime)
    }
    return handleActiveEntryUpdate(userId, body)
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
