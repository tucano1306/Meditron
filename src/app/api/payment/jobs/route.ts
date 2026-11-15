import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { jobInclude, parseJobInput, serializeJob, withDerivedFields } from '@/lib/payment-store'
import { rebalanceDayPay, resolveJobCompany } from '@/lib/pay-company-store'
import { summarizeJobs } from '@/lib/payment-jobs'
import { jobSearchOrder, jobSearchWhere, parseJobSearch, refineJobs } from '@/lib/payment-search'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Trabajos que se devuelven como máximo */
const MAX_RESULTS = 500
/** Trabajos que se revisan para filtrar por monto u ordenar por $/h */
const MAX_SCAN = 5000

// GET - Trabajos terminados con los filtros de la búsqueda (ver payment-search):
// texto, fechas, cobro, compañías, método, vehículo, propina, monto y orden.
// Los totales son de todo lo encontrado aunque la lista se corte.
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const search = parseJobSearch(new URL(request.url).searchParams)
    const rows = await prisma.paymentEntry.findMany({
      where: jobSearchWhere(userId, search),
      include: jobInclude,
      orderBy: jobSearchOrder(search),
      take: MAX_SCAN,
    })
    const found = refineJobs(rows.map(serializeJob), search)
    return NextResponse.json({
      success: true,
      data: {
        jobs: found.slice(0, MAX_RESULTS),
        totals: summarizeJobs(found),
        truncated: found.length > MAX_RESULTS || rows.length === MAX_SCAN,
      },
    })
  } catch (error) {
    console.error('Error listing payment jobs:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener los trabajos' }, { status: 500 })
  }
}

// POST - Agregar un trabajo ya terminado (sin cronómetro). Con una compañía que
// paga por día y `autoPay`, el pago lo pone la compañía (una vez por día)
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const body = await request.json()
    const parsed = parseJobInput(body, false)
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    const choice = await resolveJobCompany(userId, body, null)
    if (!choice.ok) return NextResponse.json({ success: false, error: choice.error }, { status: 400 })

    const data = withDerivedFields(parsed.value, null)
    const row = await prisma.$transaction(async tx => {
      const created = await tx.paymentEntry.create({
        data: {
          ...(data as Prisma.PaymentEntryUncheckedCreateInput),
          companyId: choice.value.companyId,
          amountAuto: choice.value.amountAuto,
          userId,
          completed: true,
        },
      })
      await rebalanceDayPay(tx, userId, created.companyId, created.date)
      return tx.paymentEntry.findUniqueOrThrow({ where: { id: created.id }, include: jobInclude })
    })
    return NextResponse.json({ success: true, data: serializeJob(row) })
  } catch (error) {
    console.error('Error creating payment job:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar el trabajo' }, { status: 500 })
  }
}
