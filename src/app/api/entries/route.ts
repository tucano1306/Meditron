import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getOrCreateWeek, getOrCreateWeekFromCalendarDate, updateWeekTotals, updateMonthSummary } from '@/lib/week-utils'
import { getFloridaDateComponents } from '@/lib/utils'
import { breakRuleOf, breakToDeduct, payScopeOf, ruleFor, toDateKey, type Company } from '@/lib/companies'
import { recalculateCompanyAmounts } from '@/lib/pay-periods'
import { getUserCompany, resolveWriteCompany } from '@/lib/company-store'
import { intInRange, isDateKey, optionalMoney, parseEntryTexts } from '@/lib/input'
import { findBreakEntry, setEntryBreaks } from '@/lib/breaks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

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
    const companyId = searchParams.get('companyId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Record<string, unknown> = { userId }

    if (companyId) {
      where.companyId = companyId
    }

    // Rango de días (YYYY-MM-DD, inclusive): calendario de la búsqueda por día
    if (from || to) {
      const range: { gte?: Date; lte?: Date } = {}
      if (from && DATE_KEY.test(from)) range.gte = new Date(`${from}T00:00:00Z`)
      if (to && DATE_KEY.test(to)) range.lte = new Date(`${to}T00:00:00Z`)
      where.date = range
    }

    // Buscar una entrada concreta (usado por el modal de detalle al refrescar
    // tras guardar). Sin este filtro se devolvían TODAS las entradas del usuario.
    if (id) {
      where.id = id
    }

    if (weekId) {
      where.weekId = weekId
    }

    if (date) {
      if (!isDateKey(date)) {
        return NextResponse.json({ success: false, error: 'Fecha inválida' }, { status: 400 })
      }
      where.date = new Date(`${date}T00:00:00Z`)
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

    // Con overtime, al quitar horas cambia el monto del resto de la semana o del día
    const company = await getUserCompany(userId, entry.companyId)
    if (company) {
      await recalculateCompanyAmounts(userId, company, [toDateKey(entry.date)])
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
    const { hours, minutes, payment, hourlyRate, date } = body

    const texts = parseEntryTexts(body)
    if (!texts.ok) {
      return NextResponse.json({ success: false, error: texts.error }, { status: 400 })
    }
    const calculated = optionalMoney(body.calculatedAmount, 'El monto')
    const paid = optionalMoney(body.paidAmount, 'El pago de la compañía')
    if (!calculated.ok || !paid.ok) {
      return NextResponse.json({ success: false, error: !calculated.ok ? calculated.error : (paid as { error: string }).error }, { status: 400 })
    }
    const { jobNumber, vehicle, observation } = texts.value
    const calculatedAmount = calculated.value ?? undefined
    const paidAmount = paid.value ?? undefined

    const company = await resolveWriteCompany(userId, body.companyId)
    if (!company) {
      return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 400 })
    }

    // Entrada con hora de entrada y salida exactas
    if (body.startTime && body.endTime) {
      return createTimedEntry(userId, company, body)
    }

    if (hours === undefined || minutes === undefined || payment === undefined) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    const totalSeconds = Math.round((Number(hours) * 3600) + (Number(minutes) * 60))
    if (!Number.isFinite(totalSeconds) || Number(hours) < 0 || Number(minutes) < 0 || totalSeconds <= 0 || totalSeconds > 7 * 24 * 3600) {
      return NextResponse.json({ success: false, error: 'Horas inválidas' }, { status: 400 })
    }
    if (date && !isDateKey(date)) {
      return NextResponse.json({ success: false, error: 'Fecha inválida' }, { status: 400 })
    }
    
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
    if (jobNumber) entryExtraData.jobNumber = jobNumber
    if (vehicle) entryExtraData.vehicle = vehicle
    // Si no viene calculatedAmount del body, calcularlo con la tarifa vigente de la compañía
    const resolvedCalculatedAmount = calculatedAmount === undefined
      ? (totalSeconds / 3600) * ruleFor(company, toDateKey(targetDate)).hourlyRate
      : Number(calculatedAmount)
    entryExtraData.calculatedAmount = resolvedCalculatedAmount
    if (paidAmount !== undefined) {
      entryExtraData.paidAmount = Number(paidAmount)
      entryExtraData.companyPaid = Number(paidAmount)
    }
    if (observation) entryExtraData.observation = observation

    const entry = await prisma.timeEntry.create({
      data: {
        startTime,
        endTime,
        duration: totalSeconds,
        date: targetDate,
        weekId: week.id,
        userId,
        companyId: company.id,
        ...entryExtraData,
      }
    })

    // Actualizar totales
    await updateWeekTotals(week.id, userId)
    await updateMonthSummary(targetYear, targetMonth, userId)
    await recalculateCompanyAmounts(userId, company, [toDateKey(targetDate)])

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
async function createTimedEntry(userId: string, company: Company, body: Record<string, unknown>) {
  const start = new Date(String(body.startTime))
  const end = new Date(String(body.endTime))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ success: false, error: 'Horas inválidas' }, { status: 400 })
  }
  const shift = Math.floor((end.getTime() - start.getTime()) / 1000)
  if (shift <= 0) {
    return NextResponse.json({ success: false, error: 'La salida debe ser posterior a la entrada' }, { status: 400 })
  }
  if (shift > 24 * 3600) {
    return NextResponse.json({ success: false, error: 'Un registro no puede pasar de 24 horas' }, { status: 400 })
  }

  // Break sin pago: los minutos que diga el formulario o, si no dice, los de la compañía
  const breakMinutes = body.breakMinutes === undefined ? undefined : intInRange(body.breakMinutes, 0, 180)
  if (breakMinutes === null) {
    return NextResponse.json({ success: false, error: 'Revisa los minutos de break' }, { status: 400 })
  }
  const breakSeconds = breakMinutes === undefined
    ? breakToDeduct(breakRuleOf(company), shift, shift)
    : Math.max(0, Math.min(breakMinutes * 60, shift - 60))
  const duration = shift - breakSeconds

  const day = getFloridaDateComponents(start)
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day))
  const week = await getOrCreateWeekFromCalendarDate(day.year, day.month, day.day, userId)

  const texts = parseEntryTexts({ observation: body.observation })
  if (!texts.ok) {
    return NextResponse.json({ success: false, error: texts.error }, { status: 400 })
  }
  const observation = texts.value.observation ?? null

  const entry = await prisma.timeEntry.create({
    data: {
      startTime: start,
      endTime: end,
      duration,
      date,
      weekId: week.id,
      userId,
      companyId: company.id,
      observation,
      breakSeconds,
      // Tarifa vigente; si la compañía paga overtime lo ajusta el recálculo de abajo
      calculatedAmount: (duration / 3600) * ruleFor(company, toDateKey(date)).hourlyRate,
    }
  })

  await updateWeekTotals(week.id, userId)
  await updateMonthSummary(week.year, week.month, userId)
  await recalculateCompanyAmounts(userId, company, [toDateKey(date)])

  const saved = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } })
  return NextResponse.json({ success: true, data: { entry: saved } })
}

// Función auxiliar para construir datos de actualización de trabajo
function buildJobUpdateData(jobNumber?: string | null, vehicle?: string | null, calculatedAmount?: number, paidAmount?: number | null, observation?: string | null, serviceType?: string | null): Record<string, unknown> {
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
    const { startTime, endTime } = body
    const texts = parseEntryTexts(body)
    if (!texts.ok) {
      return NextResponse.json({ success: false, error: texts.error }, { status: 400 })
    }
    const calculated = optionalMoney(body.calculatedAmount, 'El monto')
    const paid = optionalMoney(body.paidAmount, 'El pago de la compañía')
    if (!calculated.ok || !paid.ok) {
      return NextResponse.json({ success: false, error: !calculated.ok ? calculated.error : (paid as { error: string }).error }, { status: 400 })
    }
    const { jobNumber, vehicle, serviceType, observation } = texts.value
    const paidAmount = paid.value
    let calculatedAmount = calculated.value ?? undefined

    // Break sin pago del turno: si no viene, se conserva el que tenía
    const breakMinutes = body.breakMinutes === undefined ? undefined : intInRange(body.breakMinutes, 0, 180)
    if (breakMinutes === null) {
      return NextResponse.json({ success: false, error: 'Revisa los minutos de break' }, { status: 400 })
    }
    if (breakMinutes !== undefined && !entry.endTime) {
      return NextResponse.json({ success: false, error: 'El break de un turno en curso se elige en el cronómetro' }, { status: 400 })
    }
    const oldBreak = entry.breakSeconds ?? 0
    const newBreak = breakMinutes === undefined ? oldBreak : breakMinutes * 60

    // Compañía actual del trabajo y, si se pide moverlo, la nueva
    const oldCompany = await resolveWriteCompany(userId, entry.companyId)
    const newCompany = body.companyId === undefined ? oldCompany : await getUserCompany(userId, body.companyId)
    if (!oldCompany || !newCompany) {
      return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 400 })
    }
    const companyChanged = newCompany.id !== oldCompany.id

    // Recalcula el overtime en los grupos (semana o día) afectados por el cambio
    const recalcAmounts = async (newDateKey: string) => {
      await recalculateCompanyAmounts(userId, oldCompany, [toDateKey(entry.date)])
      if (companyChanged || newDateKey !== toDateKey(entry.date)) {
        await recalculateCompanyAmounts(userId, newCompany, [newDateKey])
      }
    }

    // Si los tiempos no vienen o no cambiaron, solo actualizar campos de trabajo
    const isOnlyJobUpdate = (startTime === undefined && endTime === undefined) || (
      startTime === entry.startTime.toISOString() && endTime === entry.endTime?.toISOString()
    )

    if (isOnlyJobUpdate) {
      const dateKey = toDateKey(entry.date)
      if (payScopeOf(newCompany, dateKey, id).kind !== 'entry') {
        // Con overtime el monto lo calcula el sistema, no se edita a mano
        calculatedAmount = undefined
      } else if (companyChanged && calculatedAmount === undefined) {
        // Pasa a una compañía por hora: su tarifa vigente
        calculatedAmount = ((entry.duration ?? 0) / 3600) * ruleFor(newCompany, dateKey).hourlyRate
      }
      let updatedEntry = await prisma.timeEntry.update({
        where: { id },
        data: {
          companyId: newCompany.id,
          ...buildJobUpdateData(jobNumber, vehicle, calculatedAmount, paidAmount, observation, serviceType)
        }
      })
      // Actualizar totales de semana y mes para mantener consistencia
      if (entry.weekId) {
        await updateWeekTotals(entry.weekId, userId)
      }
      const entryDateForSummary = new Date(entry.date)
      await updateMonthSummary(entryDateForSummary.getFullYear(), entryDateForSummary.getMonth() + 1, userId)
      await recalcAmounts(dateKey)
      // Poner o quitar el break: ajusta horas, monto y totales
      if (newBreak !== oldBreak) {
        const breakEntry = await findBreakEntry(userId, id)
        if (breakEntry) await setEntryBreaks(userId, newCompany, [{ entry: breakEntry, breakSeconds: newBreak }])
      }
      updatedEntry = await prisma.timeEntry.findUniqueOrThrow({ where: { id } })
      return NextResponse.json({ success: true, data: updatedEntry })
    }

    // Validar tiempos
    if (!startTime || !endTime) {
      return NextResponse.json({ success: false, error: 'startTime y endTime son requeridos' }, { status: 400 })
    }

    const newStart = new Date(String(startTime))
    const newEnd = new Date(String(endTime))
    const shift = Math.floor((newEnd.getTime() - newStart.getTime()) / 1000)

    if (!Number.isFinite(shift)) {
      return NextResponse.json({ success: false, error: 'Horas inválidas' }, { status: 400 })
    }
    if (shift > 7 * 24 * 3600) {
      return NextResponse.json({ success: false, error: 'Un registro no puede pasar de 7 días' }, { status: 400 })
    }
    if (shift <= 0) {
      return NextResponse.json({ success: false, error: 'El tiempo de fin debe ser posterior al inicio' }, { status: 400 })
    }
    // Se paga de la entrada a la salida menos el break del turno
    const breakSeconds = Math.max(0, Math.min(newBreak, shift - 60))
    const duration = shift - breakSeconds

    // Usar zona horaria de Florida para determinar la fecha
    const floridaComponents = getFloridaDateComponents(newStart)
    // Crear fecha como UTC midnight para almacenamiento @db.Date correcto
    const entryDate = new Date(Date.UTC(floridaComponents.year, floridaComponents.month - 1, floridaComponents.day))
    
    // getOrCreateWeek ahora maneja correctamente fechas UTC midnight
    const newWeek = await getOrCreateWeek(newStart, userId)
    const oldWeekId = entry.weekId

    // Si no se mandó calculatedAmount explícito (o la compañía paga overtime),
    // calcular con la tarifa vigente; el overtime se ajusta después
    const newDateKey = toDateKey(entryDate)
    let resolvedCalculatedAmount: number
    if (calculatedAmount === undefined || payScopeOf(newCompany, newDateKey, id).kind !== 'entry') {
      resolvedCalculatedAmount = (duration / 3600) * ruleFor(newCompany, newDateKey).hourlyRate
    } else {
      resolvedCalculatedAmount = Number(calculatedAmount)
    }

    let updatedEntry = await prisma.timeEntry.update({
      where: { id },
      data: {
        startTime: newStart,
        endTime: newEnd,
        duration,
        breakSeconds,
        date: entryDate,
        weekId: newWeek.id,
        // Limpiar campos de pausa — los tiempos fueron editados manualmente
        // y el duration ya está recalculado como salida − entrada − break
        accumulatedSeconds: 0,
        pausedAt: null,
        lastResumeTime: null,
        companyId: newCompany.id,
        ...buildJobUpdateData(jobNumber, vehicle, resolvedCalculatedAmount, paidAmount, observation, serviceType)
      }
    })

    // Actualizar totales
    if (oldWeekId && oldWeekId !== newWeek.id) {
      await updateWeekTotals(oldWeekId, userId)
    }
    await updateWeekTotals(newWeek.id, userId)
    await updateMonthSummary(floridaComponents.year, floridaComponents.month, userId)
    await recalcAmounts(newDateKey)
    updatedEntry = await prisma.timeEntry.findUniqueOrThrow({ where: { id } })

    return NextResponse.json({ success: true, data: updatedEntry })
  } catch (error) {
    console.error('Error updating entry:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar entrada' }, { status: 500 })
  }
}
