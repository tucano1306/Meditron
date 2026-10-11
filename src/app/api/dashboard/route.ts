import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getISOWeekAndYear, getFloridaDateComponents } from '@/lib/utils'
import { addDaysToKey, dateKeyToUTC, getPayPeriod, overtimeRulesOf, payScopeOf, ruleFor } from '@/lib/companies'
import { getUserCompanies } from '@/lib/company-store'
import { getSinglePayPeriod } from '@/lib/pay-periods'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DurationEntry = { duration: number | null; calculatedAmount: number | null }

function sumEarnings(entries: DurationEntry[], hourlyRate: number): number {
  return entries.reduce(
    (sum, e) => sum + (e.calculatedAmount ?? ((e.duration ?? 0) / 3600) * hourlyRate),
    0
  )
}

function sumSeconds(entries: DurationEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.duration ?? 0), 0)
}

// GET - Dashboard de una compañía (?companyId=; por defecto la primera): hoy,
// su semana de pago actual (con su día de inicio y overtime) y el mes calendario
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const companies = await getUserCompanies(userId)
    const companyId = new URL(request.url).searchParams.get('companyId')
    const company = companies.find(c => c.id === companyId) ?? companies.find(c => !c.archived) ?? companies[0]
    const ofCompany = <T extends { companyId: string | null }>(list: T[]): T[] =>
      list.filter(e => e.companyId === company.id)

    // Usar timestamp real y calcular componentes de Florida directamente
    // IMPORTANTE: No usar getFloridaDate() + getWeekNumber() porque causa doble conversión
    const realNow = new Date()
    const floridaComponents = getFloridaDateComponents(realNow)
    const year = floridaComponents.year
    const month = floridaComponents.month
    const { weekNumber } = getISOWeekAndYear(realNow)

    // Timer activo
    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        endTime: null,
        userId
      }
    })

    // Entradas de hoy - usar componentes de Florida para UTC midnight
    const todayLocal = new Date(Date.UTC(floridaComponents.year, floridaComponents.month - 1, floridaComponents.day))
    const tomorrowLocal = new Date(Date.UTC(floridaComponents.year, floridaComponents.month - 1, floridaComponents.day + 1))

    const todayEntries = ofCompany(await prisma.timeEntry.findMany({
      where: {
        date: {
          gte: todayLocal,
          lt: tomorrowLocal
        },
        userId
      },
      orderBy: {
        startTime: 'desc'
      }
    }))

    // Calcular totales de hoy
    const todayTotalSeconds = todayEntries.reduce(
      (sum: number, entry: { duration: number | null }) => sum + (entry.duration || 0),
      0
    )
    const todayHours = todayTotalSeconds / 3600
    const todayKey = `${floridaComponents.year}-${String(floridaComponents.month).padStart(2, '0')}-${String(floridaComponents.day).padStart(2, '0')}`
    const currentRule = ruleFor(company, todayKey)
    const hourlyRate = currentRule.hourlyRate
    const todayEarnings = sumEarnings(todayEntries, hourlyRate)

    // Semana de pago de la compañía (su día de inicio, con overtime si aplica)
    const payWeek = await getSinglePayPeriod(userId, company, todayKey)
    const weekData = {
      start: payWeek.start,
      end: payWeek.end,
      // El número de semana ISO solo coincide con semanas de lunes a domingo
      weekNumber: company.weekStartsOn === 1 ? weekNumber : null,
      totalSeconds: payWeek.totalSeconds,
      overtimeSeconds: payWeek.overtimeSeconds,
      earnings: payWeek.totalPay,
    }

    // Mes calendario: trabajos con fecha dentro del mes
    const monthStart = `${todayKey.slice(0, 7)}-01`
    const monthEnd = addDaysToKey(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`, -1)
    const monthEntries = await prisma.timeEntry.findMany({
      where: { userId, companyId: company.id, duration: { not: null }, date: { gte: dateKeyToUTC(monthStart), lte: dateKeyToUTC(monthEnd) } },
      select: { duration: true, calculatedAmount: true },
    })
    const monthData = { year, month, totalSeconds: sumSeconds(monthEntries), earnings: sumEarnings(monthEntries, hourlyRate) }

    // Horas ya cerradas en el grupo de overtime actual (semana de pago o día),
    // para que el cronómetro calcule el overtime en vivo
    const scope = payScopeOf(company, todayKey, '')
    const period = getPayPeriod(todayKey, company.weekStartsOn)
    const overtimeEntries = scope.kind === 'entry' ? [] : await prisma.timeEntry.findMany({
      where: {
        userId,
        companyId: company.id,
        endTime: { not: null },
        date: { gte: dateKeyToUTC(scope.start), lte: dateKeyToUTC(scope.end) }
      },
      select: { duration: true }
    })

    // Estado del timer
    let timerState = {
      isRunning: false,
      startTime: null as string | null,
      currentEntryId: null as string | null,
      elapsedSeconds: 0
    }

    if (activeEntry) {
      // Usar timestamp real para calcular elapsed time
      timerState = {
        isRunning: true,
        startTime: activeEntry.startTime.toISOString(),
        currentEntryId: activeEntry.id,
        elapsedSeconds: Math.max(0, Math.floor(
          (realNow.getTime() - new Date(activeEntry.startTime).getTime()) / 1000
        ))
      }
    }

    // Componentes de fecha en Florida ya calculados arriba
    const todayDateString = `${floridaComponents.year}-${String(floridaComponents.month).padStart(2, '0')}-${String(floridaComponents.day).padStart(2, '0')}`

    return NextResponse.json({
      success: true,
      data: {
        timerState,
        companyId: company.id,
        runningCompanyId: activeEntry?.companyId ?? null,
        overtime: {
          kind: scope.kind,
          periodStart: period.start,
          periodEnd: period.end,
          completedSeconds: overtimeEntries.reduce((sum, e) => sum + (e.duration ?? 0), 0),
          rules: overtimeRulesOf(currentRule)
        },
        today: {
          date: todayDateString,
          entries: todayEntries,
          totalSeconds: todayTotalSeconds,
          totalHours: todayHours,
          earnings: todayEarnings
        },
        currentWeek: weekData,
        monthSummary: monthData,
        hourlyRate
      }
    })
  } catch (error) {
    console.error('Error getting dashboard:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener dashboard' },
      { status: 500 }
    )
  }
}

// PATCH - Actualizar hourlyRate del usuario
export async function PATCH(request: Request) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { hourlyRate } = body

    if (typeof hourlyRate !== 'number' || !Number.isFinite(hourlyRate) || hourlyRate <= 0 || hourlyRate > 10000) {
      return NextResponse.json(
        { success: false, error: 'Tarifa inválida' },
        { status: 400 }
      )
    }

    const updatedUser = await prisma.user.update({
      where: { id: authResult.user.id },
      data: { hourlyRate },
      select: { hourlyRate: true }
    })

    return NextResponse.json({
      success: true,
      data: { hourlyRate: updatedUser.hourlyRate }
    })
  } catch (error) {
    console.error('Error updating hourly rate:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar tarifa' },
      { status: 500 }
    )
  }
}
