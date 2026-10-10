import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getOrCreateWeek, getOrCreateWeekFromCalendarDate, updateWeekTotals, updateMonthSummary } from '@/lib/week-utils'
import { getFloridaDateComponents, HOURLY_RATE } from '@/lib/utils'
import { detectCompany, isCompanyId, toDateKey, withCompanyTag } from '@/lib/companies'
import { recalculateTecnofuelPeriod } from '@/lib/pay-periods'

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
    const id = searchParams.get('id')
    const weekId = searchParams.get('weekId')
    const date = searchParams.get('date')
    const jobNumber = searchParams.get('jobNumber')

    const where: Record<string, unknown> = { userId }

    // Buscar una entrada concreta (usado por el modal de detalle al refrescar
    // tras guardar). Sin este filtro se devolvían TODAS las entradas del usuario.
    if (id) {
      where.id = id
    }

    if (weekId) {
      where.weekId = weekId
    }

    if (date) {
      where.date = new Date(date)
    }

    if (jobNumber) {
      where.jobNumber = jobNumber
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

    // Tecnofuel: al quitar horas cambia el overtime del resto de la semana
    if (detectCompany(entry.observation) === 'tecnofuel') {
      await recalculateTecnofuelPeriod(userId, toDateKey(entry.date))
    }

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
    const { hours, minutes, payment, hourlyRate, date, jobNumber, vehicle, calculatedAmount, paidAmount, company, observation } = body

    // Entrada con hora de entrada y salida exactas (p. ej. horas de Tecnofuel)
    if (body.startTime && body.endTime) {
      return createTimedEntry(userId, authResult.user.hourlyRate ?? HOURLY_RATE, body)
    }

    if (hours === undefined || minutes === undefined || payment === undefined) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    const totalSeconds = (Number(hours) * 3600) + (Number(minutes) * 60)
    
    // Si se proporciona una fecha, usarla; si no, usar hoy en Florida
    let targetYear: number
    let targetMonth: number
    let targetDay: number
    if (date) {
      // Parsear la fecha en formato YYYY-MM-DD
      const [y, m, d] = date.split('-').map(Number)
      targetYear = y
      targetMonth = m
      targetDay = d
    } else {
      // Usar fecha actual en Florida (no la del servidor)
      const floridaNow = getFloridaDateComponents(new Date())
      targetYear = floridaNow.year
      targetMonth = floridaNow.month
      targetDay = floridaNow.day
    }
    // Crear fecha como UTC midnight para almacenamiento @db.Date correcto
    const targetDate = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay))
    
    // Crear tiempos de inicio y fin para la fecha seleccionada
    // Ponemos el fin a las 18:00 de ese día y el inicio según la duración
    const endTime = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 18, 0, 0))
    const startTime = new Date(endTime.getTime() - totalSeconds * 1000)

    // Obtener o crear semana usando fecha calendario directamente
    // (NO convertir a Florida porque la fecha ya es la que el usuario seleccionó)
    const week = await getOrCreateWeekFromCalendarDate(targetYear, targetMonth, targetDay, userId)

    // Crear la entrada
    const entryExtraData: Record<string, unknown> = {}
    if (jobNumber) entryExtraData.jobNumber = String(jobNumber)
    if (vehicle) entryExtraData.vehicle = String(vehicle)
    // Si no viene calculatedAmount del body, calcularlo con la tasa real del usuario
    const userHourlyRate = authResult.user.hourlyRate ?? HOURLY_RATE
    const resolvedCalculatedAmount = calculatedAmount === undefined
      ? (totalSeconds / 3600) * userHourlyRate
      : Number(calculatedAmount)
    entryExtraData.calculatedAmount = resolvedCalculatedAmount
    if (paidAmount !== undefined) {
      entryExtraData.paidAmount = Number(paidAmount)
      entryExtraData.companyPaid = Number(paidAmount)
    }
    if (isCompanyId(company)) {
      entryExtraData.observation = withCompanyTag(observation, company)
    } else if (observation) {
      entryExtraData.observation = String(observation)
    }

    const entry = await prisma.timeEntry.create({
      data: {
        startTime,
        endTime,
        duration: totalSeconds,
        date: targetDate,
        weekId: week.id,
        userId,
        ...entryExtraData,
      }
    })

    // Actualizar totales
    await updateWeekTotals(week.id, userId)
    await updateMonthSummary(targetYear, targetMonth, userId)
    if (detectCompany(entry.observation) === 'tecnofuel') {
      await recalculateTecnofuelPeriod(userId, toDateKey(targetDate))
    }

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

// Crea una entrada a partir de su hora de entrada y salida (instantes UTC que el
// cliente calcula desde la hora de Florida). El día es el de la entrada en Florida.
async function createTimedEntry(userId: string, userHourlyRate: number, body: Record<string, unknown>) {
  const start = new Date(String(body.startTime))
  const end = new Date(String(body.endTime))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ success: false, error: 'Horas inválidas' }, { status: 400 })
  }
  const duration = Math.floor((end.getTime() - start.getTime()) / 1000)
  if (duration <= 0) {
    return NextResponse.json({ success: false, error: 'La salida debe ser posterior a la entrada' }, { status: 400 })
  }
  if (duration > 24 * 3600) {
    return NextResponse.json({ success: false, error: 'Un registro no puede pasar de 24 horas' }, { status: 400 })
  }

  const day = getFloridaDateComponents(start)
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day))
  const week = await getOrCreateWeekFromCalendarDate(day.year, day.month, day.day, userId)

  const note = typeof body.observation === 'string' ? body.observation : null
  const observation = isCompanyId(body.company) ? withCompanyTag(note, body.company) : note

  const entry = await prisma.timeEntry.create({
    data: {
      startTime: start,
      endTime: end,
      duration,
      date,
      weekId: week.id,
      userId,
      observation,
      // Larry's: tarifa por hora del usuario. Tecnofuel: lo fija el recálculo semanal.
      calculatedAmount: (duration / 3600) * userHourlyRate,
    }
  })

  await updateWeekTotals(week.id, userId)
  await updateMonthSummary(week.year, week.month, userId)
  if (detectCompany(observation) === 'tecnofuel') {
    await recalculateTecnofuelPeriod(userId, toDateKey(date))
  }

  const saved = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } })
  return NextResponse.json({ success: true, data: { entry: saved } })
}

// Función auxiliar para construir datos de actualización de trabajo
function buildJobUpdateData(jobNumber?: string, vehicle?: string | null, calculatedAmount?: number, paidAmount?: number, observation?: string | null, serviceType?: string | null): Record<string, unknown> {
  const updateData: Record<string, unknown> = {}
  if (jobNumber !== undefined) updateData.jobNumber = jobNumber || null
  if (vehicle !== undefined) updateData.vehicle = vehicle || null
  if (serviceType !== undefined) updateData.serviceType = serviceType || null
  if (observation !== undefined) updateData.observation = observation || null
  if (calculatedAmount !== undefined) updateData.calculatedAmount = calculatedAmount
  if (paidAmount !== undefined) {
    updateData.paidAmount = paidAmount
    updateData.companyPaid = paidAmount // Guardar también en companyPaid para el resumen semanal
  }
  return updateData
}

// PATCH - Actualizar entrada existente
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response

    const userId = authResult.user.id
    const id = new URL(request.url).searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    }

    const entry = await prisma.timeEntry.findFirst({ where: { id, userId } })
    if (!entry) {
      return NextResponse.json({ success: false, error: 'Entrada no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const { startTime, endTime, jobNumber, vehicle, paidAmount, serviceType, company } = body
    let { calculatedAmount, observation } = body

    // La compañía va en la nota: si se pide cambiarla, se reescribe la etiqueta
    if (isCompanyId(company)) {
      observation = withCompanyTag(observation === undefined ? entry.observation : observation, company)
    }
    const oldCompany = detectCompany(entry.observation)
    const newCompany = detectCompany(observation === undefined ? entry.observation : observation)
    const userHourlyRate = authResult.user.hourlyRate ?? HOURLY_RATE
    if (newCompany === 'tecnofuel') {
      // El monto de Tecnofuel lo calcula el overtime semanal, no se edita a mano
      calculatedAmount = undefined
    }

    // Recalcula el overtime de Tecnofuel en las semanas afectadas por el cambio
    const recalcTecnofuel = async (newDateKey: string) => {
      if (oldCompany === 'tecnofuel') await recalculateTecnofuelPeriod(userId, toDateKey(entry.date))
      if (newCompany === 'tecnofuel') await recalculateTecnofuelPeriod(userId, newDateKey)
    }

    // Si los tiempos no cambiaron, solo actualizar campos de trabajo
    const isOnlyJobUpdate = startTime === entry.startTime.toISOString() &&
                            endTime === entry.endTime?.toISOString()

    if (isOnlyJobUpdate) {
      if (oldCompany === 'tecnofuel' && newCompany !== 'tecnofuel' && calculatedAmount === undefined) {
        // Pasa a Larry's: vuelve a la tarifa por hora del usuario
        calculatedAmount = ((entry.duration ?? 0) / 3600) * userHourlyRate
      }
      let updatedEntry = await prisma.timeEntry.update({
        where: { id },
        data: buildJobUpdateData(jobNumber, vehicle, calculatedAmount, paidAmount, observation, serviceType)
      })
      // Actualizar totales de semana y mes para mantener consistencia
      if (entry.weekId) {
        await updateWeekTotals(entry.weekId, userId)
      }
      const entryDateForSummary = new Date(entry.date)
      await updateMonthSummary(entryDateForSummary.getFullYear(), entryDateForSummary.getMonth() + 1, userId)
      if (oldCompany === 'tecnofuel' || newCompany === 'tecnofuel') {
        await recalcTecnofuel(toDateKey(entry.date))
        updatedEntry = await prisma.timeEntry.findUniqueOrThrow({ where: { id } })
      }
      return NextResponse.json({ success: true, data: updatedEntry })
    }

    // Validar tiempos
    if (!startTime || !endTime) {
      return NextResponse.json({ success: false, error: 'startTime y endTime son requeridos' }, { status: 400 })
    }

    const newStart = new Date(startTime)
    const newEnd = new Date(endTime)
    const duration = Math.floor((newEnd.getTime() - newStart.getTime()) / 1000)

    if (duration <= 0) {
      return NextResponse.json({ success: false, error: 'El tiempo de fin debe ser posterior al inicio' }, { status: 400 })
    }

    // Usar zona horaria de Florida para determinar la fecha
    const floridaComponents = getFloridaDateComponents(newStart)
    // Crear fecha como UTC midnight para almacenamiento @db.Date correcto
    const entryDate = new Date(Date.UTC(floridaComponents.year, floridaComponents.month - 1, floridaComponents.day))
    
    // getOrCreateWeek ahora maneja correctamente fechas UTC midnight
    const newWeek = await getOrCreateWeek(newStart, userId)
    const oldWeekId = entry.weekId

    // Si no se mandó calculatedAmount explícito, recalcular con la tasa del usuario
    let resolvedCalculatedAmount: number
    if (calculatedAmount === undefined) {
      resolvedCalculatedAmount = (duration / 3600) * userHourlyRate
    } else {
      resolvedCalculatedAmount = Number(calculatedAmount)
    }

    let updatedEntry = await prisma.timeEntry.update({
      where: { id },
      data: {
        startTime: newStart,
        endTime: newEnd,
        duration,
        date: entryDate,
        weekId: newWeek.id,
        // Limpiar campos de pausa — los tiempos fueron editados manualmente
        // y el duration ya está recalculado como endTime-startTime
        accumulatedSeconds: 0,
        pausedAt: null,
        lastResumeTime: null,
        ...buildJobUpdateData(jobNumber, vehicle, resolvedCalculatedAmount, paidAmount, observation, serviceType)
      }
    })

    // Actualizar totales
    if (oldWeekId && oldWeekId !== newWeek.id) {
      await updateWeekTotals(oldWeekId, userId)
    }
    await updateWeekTotals(newWeek.id, userId)
    await updateMonthSummary(floridaComponents.year, floridaComponents.month, userId)
    if (oldCompany === 'tecnofuel' || newCompany === 'tecnofuel') {
      await recalcTecnofuel(toDateKey(entryDate))
      updatedEntry = await prisma.timeEntry.findUniqueOrThrow({ where: { id } })
    }

    return NextResponse.json({ success: true, data: updatedEntry })
  } catch (error) {
    console.error('Error updating entry:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar entrada' }, { status: 500 })
  }
}
