import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getUserCompanies } from '@/lib/company-store'
import { getSinglePayPeriod } from '@/lib/pay-periods'
import { addDaysToKey, toDateKey } from '@/lib/companies'
import { getFloridaDateString } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Resumen de la pantalla de inicio: semana de pago actual de cada
// compañía activa (horas por día y monto) y el turno en curso, si hay uno
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response

    const userId = authResult.user.id
    const today = getFloridaDateString()
    const companies = (await getUserCompanies(userId)).filter(c => !c.archived)

    const [periods, lastDates, activeEntry] = await Promise.all([
      Promise.all(companies.map(c => getSinglePayPeriod(userId, c, today))),
      prisma.timeEntry.groupBy({
        by: ['companyId'],
        where: { userId, endTime: { not: null } },
        _max: { date: true },
      }),
      prisma.timeEntry.findFirst({ where: { userId, endTime: null } }),
    ])

    const overview = periods.map(period => {
      const days = Array.from({ length: 7 }, (_, i) => ({ date: addDaysToKey(period.start, i), seconds: 0 }))
      for (const entry of period.entries) {
        const day = days.find(d => d.date === toDateKey(entry.date))
        if (day) day.seconds += entry.duration ?? 0
      }
      const last = lastDates.find(row => row.companyId === period.companyId)?._max.date
      return {
        companyId: period.companyId,
        start: period.start,
        end: period.end,
        totalSeconds: period.totalSeconds,
        overtimeSeconds: period.overtimeSeconds,
        totalPay: period.totalPay,
        jobCount: period.entries.length,
        todaySeconds: days.find(d => d.date === today)?.seconds ?? 0,
        days,
        lastWorkedDate: last ? toDateKey(last) : null,
      }
    })

    let running = null
    if (activeEntry) {
      const isPaused = activeEntry.pausedAt !== null
      const resumeRef = activeEntry.lastResumeTime ?? activeEntry.startTime
      const elapsedSeconds = isPaused
        ? activeEntry.accumulatedSeconds
        : activeEntry.accumulatedSeconds + Math.floor((Date.now() - resumeRef.getTime()) / 1000)
      running = {
        companyId: activeEntry.companyId,
        isPaused,
        elapsedSeconds: Math.max(0, elapsedSeconds),
        startTime: activeEntry.startTime.toISOString(),
        jobNumber: activeEntry.jobNumber,
      }
    }

    return NextResponse.json({ success: true, data: { today, companies: overview, running } })
  } catch (error) {
    console.error('Error getting companies overview:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener el resumen' }, { status: 500 })
  }
}
