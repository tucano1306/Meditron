import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { parseJobInput, serializeJob, withDerivedFields } from '@/lib/payment-store'
import { summarizeJobs } from '@/lib/payment-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const MAX_RESULTS = 500

// GET - Trabajos terminados. Filtros: ?from y ?to (YYYY-MM-DD), ?status
// (paid|pending) y ?q (busca en cliente, número de trabajo y notas)
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const { searchParams } = new URL(request.url)
    const where: Prisma.PaymentEntryWhereInput = { userId, completed: true }
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if ((from && DATE_KEY.test(from)) || (to && DATE_KEY.test(to))) {
      where.date = {
        ...(from && DATE_KEY.test(from) ? { gte: new Date(`${from}T00:00:00Z`) } : {}),
        ...(to && DATE_KEY.test(to) ? { lte: new Date(`${to}T00:00:00Z`) } : {}),
      }
    }
    const status = searchParams.get('status')
    if (status === 'paid' || status === 'pending') where.paymentStatus = status
    const q = searchParams.get('q')?.trim()
    if (q) {
      where.OR = [
        { client: { contains: q, mode: 'insensitive' } },
        { jobNumber: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ]
    }

    const rows = await prisma.paymentEntry.findMany({ where, orderBy: { startTime: 'desc' }, take: MAX_RESULTS })
    const jobs = rows.map(serializeJob)
    return NextResponse.json({ success: true, data: { jobs, totals: summarizeJobs(jobs), truncated: rows.length === MAX_RESULTS } })
  } catch (error) {
    console.error('Error listing payment jobs:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener los trabajos' }, { status: 500 })
  }
}

// POST - Agregar un trabajo ya terminado (sin cronómetro)
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const parsed = parseJobInput(await request.json(), false)
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })

    const data = withDerivedFields(parsed.value, null)
    const row = await prisma.paymentEntry.create({
      data: { ...(data as Prisma.PaymentEntryUncheckedCreateInput), userId, completed: true },
    })
    return NextResponse.json({ success: true, data: serializeJob(row) })
  } catch (error) {
    console.error('Error creating payment job:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar el trabajo' }, { status: 500 })
  }
}
