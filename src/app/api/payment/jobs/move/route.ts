import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { jobInclude, serializeJob } from '@/lib/payment-store'
import { rebalanceDays } from '@/lib/pay-company-store'
import { getUserCompanies } from '@/lib/company-store'
import { recalculateCompanyAmounts } from '@/lib/pay-periods'
import { getOrCreateWeekFromCalendarDate, updateMonthSummary, updateWeekTotals } from '@/lib/week-utils'
import { addDaysToKey, dateKeyToUTC, toDateKey } from '@/lib/companies'
import { jobTitle } from '@/lib/payment-jobs'
import {
  companyPaidFor, findHourlyDuplicate, hourlyAmountFor, isDuplicateMode, isMoveAmount, MAX_MOVE, observationFor,
  type MoveDuplicate, type MoveResult,
} from '@/lib/move-to-hourly'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST - Pasar trabajos de Por Pago a una compañía de Por Hora
// { ids, companyId, amount: 'rate' | 'keep', markPaid, duplicates: 'stop' | 'skip' | 'remove' | 'include' }
// Con duplicates 'stop' (lo normal) no se mueve nada si alguno ya parece estar
// en Por Hora: responde 409 con la lista para que el usuario decida.
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Datos inválidos')

    const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length < 64))] : []
    if (ids.length === 0) return bad('Elige al menos un trabajo')
    if (ids.length > MAX_MOVE) return bad(`Máximo ${MAX_MOVE} trabajos por vez`)
    const amountMode = body.amount === undefined ? 'rate' : body.amount
    if (!isMoveAmount(amountMode)) return bad('Elige cómo calcular el monto')
    const duplicates = body.duplicates === undefined ? 'stop' : body.duplicates
    if (!isDuplicateMode(duplicates)) return bad('Opción inválida')
    const markPaid = body.markPaid !== false

    const companies = await getUserCompanies(userId)
    const company = companies.find(c => c.id === body.companyId)
    if (!company) return bad('Compañía no encontrada')
    if (company.archived) return bad(`${company.name} está archivada`)

    const rows = await prisma.paymentEntry.findMany({
      where: { id: { in: ids as string[] }, userId, completed: true },
      include: jobInclude,
      orderBy: { startTime: 'asc' },
    })
    if (rows.length === 0) return NextResponse.json({ success: false, error: 'Trabajo no encontrado' }, { status: 404 })
    const jobs = rows.map(serializeJob)

    // Registros de Por Hora de esos días (y el de al lado) para ver duplicados
    const keys = jobs.map(j => j.date).sort()
    const existing = await prisma.timeEntry.findMany({
      where: {
        userId,
        date: { gte: dateKeyToUTC(addDaysToKey(keys[0], -1)), lte: dateKeyToUTC(addDaysToKey(keys[keys.length - 1], 1)) },
      },
      select: { id: true, date: true, startTime: true, endTime: true, jobNumber: true, companyId: true },
    })
    const entries = existing.map(e => ({
      id: e.id,
      date: toDateKey(e.date),
      startTime: e.startTime.toISOString(),
      endTime: e.endTime?.toISOString() ?? null,
      jobNumber: e.jobNumber,
      companyId: e.companyId,
    }))
    const names = new Map(companies.map(c => [c.id, c.name]))

    const found: MoveDuplicate[] = []
    for (const job of jobs) {
      const entry = findHourlyDuplicate(job, entries)
      if (entry) {
        found.push({
          jobId: job.id,
          jobTitle: jobTitle(job),
          entry: { ...entry, companyName: entry.companyId ? names.get(entry.companyId) ?? null : null },
        })
      }
    }
    if (found.length > 0 && duplicates === 'stop') {
      return NextResponse.json({
        success: false,
        error: found.length === 1 ? 'Este trabajo ya parece estar en Por Hora' : `${found.length} trabajos ya parecen estar en Por Hora`,
        data: { duplicates: found },
      }, { status: 409 })
    }

    const duplicateIds = new Set(duplicates === 'include' ? [] : found.map(d => d.jobId))
    const toMove = jobs.filter(j => !duplicateIds.has(j.id))
    const toRemove = duplicates === 'remove' ? jobs.filter(j => duplicateIds.has(j.id)) : []

    // Semanas de los días que se mueven (se crean fuera de la transacción)
    const weekOf = new Map<string, { id: string }>()
    for (const key of new Set(toMove.map(j => j.date))) {
      const [y, m, d] = key.split('-').map(Number)
      weekOf.set(key, await getOrCreateWeekFromCalendarDate(y, m, d, userId))
    }

    const result = await prisma.$transaction(async tx => {
      let moved = 0
      let removed = 0
      for (const job of [...toMove, ...toRemove]) {
        // Si otra pestaña ya lo movió o lo borró, se salta (no se duplica)
        const gone = await tx.paymentEntry.deleteMany({ where: { id: job.id, userId, completed: true } })
        if (gone.count === 0) continue
        if (duplicateIds.has(job.id)) { removed++; continue }

        const paid = markPaid && company.trackCompanyPaid ? companyPaidFor(job) : null
        await tx.timeEntry.create({
          data: {
            userId,
            companyId: company.id,
            weekId: weekOf.get(job.date)!.id,
            date: dateKeyToUTC(job.date),
            startTime: new Date(job.startTime),
            endTime: new Date(job.endTime),
            duration: job.duration,
            // El trabajo ya se midió tal cual: no se descuenta break
            breakSeconds: 0,
            jobNumber: job.jobNumber,
            vehicle: job.vehicle,
            observation: observationFor(job),
            calculatedAmount: hourlyAmountFor(company, job, amountMode),
            ...(paid === null ? {} : {
              paidAmount: paid,
              companyPaid: paid,
              companyPaidDate: job.paidAt ? new Date(job.paidAt) : null,
            }),
          },
        })
        moved++
      }
      // El pago por día de Por Pago se reacomoda en los días que quedaron
      await rebalanceDays(tx, userId, rows.map(r => ({ companyId: r.companyId, date: r.date })))
      return { moved, removed }
    }, { timeout: 30_000 })

    // Totales de Por Hora y, si la compañía paga overtime, sus montos
    if (result.moved > 0) {
      const weekIds = new Set([...weekOf.values()].map(w => w.id))
      for (const weekId of weekIds) await updateWeekTotals(weekId, userId)
      const months = new Set(toMove.map(j => j.date.slice(0, 7)))
      for (const month of months) {
        const [y, m] = month.split('-').map(Number)
        await updateMonthSummary(y, m, userId)
      }
      await recalculateCompanyAmounts(userId, company, [...new Set(toMove.map(j => j.date))])
    }

    const data: MoveResult = {
      moved: result.moved,
      removed: result.removed,
      skipped: duplicates === 'skip' ? found.length : 0,
      companyName: company.name,
    }
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error moving payment jobs to hourly:', error)
    return NextResponse.json({ success: false, error: 'No se pudieron pasar los trabajos' }, { status: 500 })
  }
}

function bad(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 })
}
