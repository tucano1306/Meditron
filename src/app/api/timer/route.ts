import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getOrCreateWeek, updateWeekTotals, updateMonthSummary } from '@/lib/week-utils'
import { parseClientDateTime, getFloridaDateComponents, HOURLY_RATE } from '@/lib/utils'

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
    
    // Obtener la hora del cliente (UTC) si se envía, sino usar hora actual UTC
    let now: Date
    try {
      const body = await request.json()
      now = body.clientTime ? parseClientDateTime(body.clientTime) : new Date()
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

    // Obtener o crear la semana actual (usando hora de Florida para determinar semana)
    const week = await getOrCreateWeek(now, userId)

    // Crear fecha basada en zona horaria de Florida (para agrupar por día)
    const floridaComponents = getFloridaDateComponents(now)
    const localDate = new Date(Date.UTC(floridaComponents.year, floridaComponents.month - 1, floridaComponents.day))

    // Crear nueva entrada de tiempo (startTime en UTC)
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
    
    // Obtener la hora del cliente (UTC), jobNumber y vehicle si se envía
    let now: Date
    let jobNumber: string | undefined
    let vehicle: string | undefined
    let observation: string | undefined
    try {
      const body = await request.json()
      now = body.clientTime ? parseClientDateTime(body.clientTime) : new Date()
      jobNumber = body.jobNumber
      vehicle = body.vehicle
      observation = body.observation
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

    // Calcular duración en segundos (respetando tiempo pausado)
    const isPaused = activeEntry.pausedAt !== null
    let duration: number
    if (isPaused) {
      duration = activeEntry.accumulatedSeconds
    } else {
      const resumeRef = activeEntry.lastResumeTime ?? activeEntry.startTime
      duration = activeEntry.accumulatedSeconds + Math.floor(
        (now.getTime() - new Date(resumeRef).getTime()) / 1000
      )
    }

    // Calcular monto basado en horas trabajadas
    const hours = duration / 3600
    const calculatedAmount = hours * HOURLY_RATE

    // Calcular la fecha correcta basada en la hora de FIN en Florida
    // Esto asegura que si terminas a las 2am del día 2, la fecha sea del día 2
    const floridaEndComponents = getFloridaDateComponents(now)
    const correctDate = new Date(Date.UTC(floridaEndComponents.year, floridaEndComponents.month - 1, floridaEndComponents.day))

    // Recalcular la semana correcta basada en la fecha de fin (por si cruzó límite de semana)
    const correctWeek = await getOrCreateWeek(now, userId)
    const weekChanged = correctWeek.id !== activeEntry.weekId

    // Actualizar entrada con duración, monto calculado, fecha correcta y semana correcta
    const updatedEntry = await prisma.timeEntry.update({
      where: { id: activeEntry.id },
      data: {
        endTime: now,
        duration,
        calculatedAmount,
        jobNumber: jobNumber || activeEntry.jobNumber,
        vehicle: vehicle || activeEntry.vehicle,
        observation: observation ?? activeEntry.observation,
        date: correctDate,
        weekId: correctWeek.id
      }
    })

    // Actualizar totales de la semana anterior si cambió
    if (weekChanged) {
      await updateWeekTotals(activeEntry.weekId, userId)
      // Actualizar resumen mensual de la semana anterior
      await updateMonthSummary(
        activeEntry.week.year,
        activeEntry.week.month,
        userId
      )
    }

    // Actualizar totales de la semana (actual o nueva)
    const weekTotals = await updateWeekTotals(correctWeek.id, userId)

    // Actualizar resumen mensual
    const monthTotals = await updateMonthSummary(
      correctWeek.year,
      correctWeek.month,
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
      const now = new Date()
      const isPaused = activeEntry.pausedAt !== null
      let elapsedSeconds: number

      if (isPaused) {
        elapsedSeconds = activeEntry.accumulatedSeconds
      } else {
        const resumeRef = activeEntry.lastResumeTime ?? activeEntry.startTime
        elapsedSeconds = activeEntry.accumulatedSeconds + Math.floor(
          (now.getTime() - new Date(resumeRef).getTime()) / 1000
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          isRunning: !isPaused,
          isPaused,
          startTime: activeEntry.startTime,
          currentEntryId: activeEntry.id,
          jobNumber: activeEntry.jobNumber,
          vehicle: activeEntry.vehicle,
          observation: activeEntry.observation,
          accumulatedSeconds: activeEntry.accumulatedSeconds,
          elapsedSeconds: Math.max(0, elapsedSeconds)
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

// PATCH - Actualizar jobNumber o vehicle del timer en curso
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const body = await request.json()
    const { jobNumber, vehicle, observation, action } = body

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

    // Acción de pausar
    if (action === 'pause') {
      if (activeEntry.pausedAt) {
        return NextResponse.json({ success: false, error: 'El timer ya está pausado' }, { status: 400 })
      }
      const now = new Date()
      const resumeRef = activeEntry.lastResumeTime ?? activeEntry.startTime
      const newAccumulated = activeEntry.accumulatedSeconds + Math.floor(
        (now.getTime() - new Date(resumeRef).getTime()) / 1000
      )
      const updated = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: { pausedAt: now, accumulatedSeconds: newAccumulated }
      })
      return NextResponse.json({ success: true, data: { entry: updated, accumulatedSeconds: newAccumulated } })
    }

    // Acción de reanudar
    if (action === 'resume') {
      if (!activeEntry.pausedAt) {
        return NextResponse.json({ success: false, error: 'El timer no está pausado' }, { status: 400 })
      }
      const now = new Date()
      const updated = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: { pausedAt: null, lastResumeTime: now }
      })
      return NextResponse.json({ success: true, data: { entry: updated, accumulatedSeconds: activeEntry.accumulatedSeconds } })
    }

    // Actualizar jobNumber, vehicle y/o observation
    const updateData: { jobNumber?: string; vehicle?: string; observation?: string } = {}
    if (jobNumber !== undefined) updateData.jobNumber = jobNumber
    if (vehicle !== undefined) updateData.vehicle = vehicle
    if (observation !== undefined) updateData.observation = observation
    
    const updatedEntry = await prisma.timeEntry.update({
      where: { id: activeEntry.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: {
        entry: updatedEntry,
        message: 'Entrada actualizada'
      }
    })
  } catch (error) {
    console.error('Error updating timer entry:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar entrada' },
      { status: 500 }
    )
  }
}
