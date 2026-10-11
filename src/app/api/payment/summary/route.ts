import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { serializeJob } from '@/lib/payment-store'
import { addDaysToKey, getPayPeriod } from '@/lib/companies'
import { jobEarned, ratePerHour, summarizeJobs, type PaymentJob } from '@/lib/payment-jobs'
import { getFloridaDateString } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Las semanas del modo por pago van de lunes a domingo */
const WEEK_STARTS_ON = 1
const CHART_WEEKS = 8

function inRange(job: PaymentJob, from: string, to: string): boolean {
  return job.date >= from && job.date <= to
}

/** Los N grupos que más ganaron (clientes, métodos...) */
function topGroups(jobs: PaymentJob[], keyOf: (job: PaymentJob) => string | null, limit: number) {
  const groups = new Map<string, { key: string; earned: number; count: number; seconds: number }>()
  for (const job of jobs) {
    const key = keyOf(job)
    if (!key) continue
    const group = groups.get(key) ?? { key, earned: 0, count: 0, seconds: 0 }
    group.earned += jobEarned(job)
    group.count += 1
    group.seconds += job.duration
    groups.set(key, group)
  }
  return [...groups.values()]
    .map(g => ({ ...g, rate: ratePerHour(g.earned, g.seconds) }))
    .sort((a, b) => b.earned - a.earned)
    .slice(0, limit)
}

// GET - Resumen del modo por pago: hoy, semana, mes, lo que falta por cobrar,
// los días de esta semana, las últimas 8 semanas y lo más destacado del mes
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const today = getFloridaDateString()
    const week = getPayPeriod(today, WEEK_STARTS_ON)
    const monthStart = `${today.slice(0, 7)}-01`
    const chartStart = addDaysToKey(week.start, -7 * (CHART_WEEKS - 1))
    const from = chartStart < monthStart ? chartStart : monthStart

    const [rows, pendingRows] = await Promise.all([
      prisma.paymentEntry.findMany({
        where: { userId, completed: true, date: { gte: new Date(`${from}T00:00:00Z`) } },
        orderBy: { startTime: 'asc' },
      }),
      prisma.paymentEntry.findMany({
        where: { userId, completed: true, paymentStatus: 'pending' },
        orderBy: { date: 'asc' },
      }),
    ])
    const jobs = rows.map(serializeJob)
    const pending = pendingRows.map(serializeJob)
    const monthJobs = jobs.filter(j => j.date >= monthStart)

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = addDaysToKey(week.start, i)
      const totals = summarizeJobs(jobs.filter(j => j.date === date))
      return { date, earned: totals.earned, tips: totals.tips, seconds: totals.seconds, count: totals.count }
    })
    const weeks = Array.from({ length: CHART_WEEKS }, (_, i) => {
      const start = addDaysToKey(chartStart, 7 * i)
      const end = addDaysToKey(start, 6)
      const totals = summarizeJobs(jobs.filter(j => inRange(j, start, end)))
      return { start, end, ...totals }
    })
    const best = monthJobs
      .filter(j => j.duration >= 15 * 60)
      .sort((a, b) => ratePerHour(jobEarned(b), b.duration) - ratePerHour(jobEarned(a), a.duration))[0] ?? null

    return NextResponse.json({
      success: true,
      data: {
        today: { date: today, ...summarizeJobs(jobs.filter(j => j.date === today)) },
        week: { start: week.start, end: week.end, ...summarizeJobs(jobs.filter(j => inRange(j, week.start, week.end))) },
        month: { start: monthStart, ...summarizeJobs(monthJobs) },
        pending: {
          ...summarizeJobs(pending),
          oldestDate: pending[0]?.date ?? null,
        },
        weekDays,
        weeks,
        topClients: topGroups(monthJobs, j => j.client, 5),
        byMethod: topGroups(monthJobs, j => j.paymentMethod, 7),
        bestJob: best,
      },
    })
  } catch (error) {
    console.error('Error getting payment summary:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener el resumen' }, { status: 500 })
  }
}
