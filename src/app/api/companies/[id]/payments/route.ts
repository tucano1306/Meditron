import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getUserCompany } from '@/lib/company-store'
import { getPayPeriods, getSinglePayPeriod, serializePayment } from '@/lib/pay-periods'
import { dateKeyToUTC, getPayPeriod } from '@/lib/companies'
import { isDateKey, optionalMoney, optionalText } from '@/lib/input'
import { summarizePayStatus, weekPayStatus } from '@/lib/week-payments'
import { getFloridaDateString } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

// GET - Cuánto falta cobrar de la compañía: semanas sin pago y pagadas de menos
export async function GET(_request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const { id } = await context.params
    const company = await getUserCompany(authResult.user.id, id)
    if (!company) return bad('Compañía no encontrada', 404)

    const periods = await getPayPeriods(authResult.user.id, company)
    return NextResponse.json({ success: true, data: summarizePayStatus(periods, getFloridaDateString()) })
  } catch (error) {
    console.error('Error getting payment summary:', error)
    return bad('Error al obtener los pagos', 500)
  }
}

// PUT - Registra o corrige lo que pagó la empresa por una semana de pago.
// Body: weekStart, amount (bruto), paidOn y, opcionales, netAmount, hours,
// reference y note
export async function PUT(request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id
    const { id } = await context.params
    const company = await getUserCompany(userId, id)
    if (!company) return bad('Compañía no encontrada', 404)

    const body = await request.json()
    const today = getFloridaDateString()
    if (!isDateKey(body.weekStart) || getPayPeriod(body.weekStart, company.weekStartsOn).start !== body.weekStart) {
      return bad('Semana de pago inválida')
    }
    if (body.weekStart > today) return bad('Esa semana todavía no empieza')

    const amount = optionalMoney(body.amount, 'El monto pagado')
    if (!amount.ok) return bad(amount.error)
    if (amount.value === undefined || amount.value === null) return bad('Escribe cuánto te pagaron')
    const netAmount = optionalMoney(body.netAmount, 'El monto depositado')
    if (!netAmount.ok) return bad(netAmount.error)
    const hours = optionalMoney(body.hours, 'Las horas pagadas')
    if (!hours.ok) return bad(hours.error)
    if (hours.value !== undefined && hours.value !== null && hours.value > 168) return bad('Una semana no tiene más de 168 horas')
    if (!isDateKey(body.paidOn) || body.paidOn > today) return bad('Revisa la fecha del pago')
    const reference = optionalText(body.reference, 'La referencia', 60)
    if (!reference.ok) return bad(reference.error)
    const note = optionalText(body.note, 'La nota', 300)
    if (!note.ok) return bad(note.error)

    const weekStart = dateKeyToUTC(body.weekStart)
    const data = {
      amount: amount.value,
      netAmount: netAmount.value ?? null,
      hours: hours.value ?? null,
      paidOn: dateKeyToUTC(body.paidOn),
      reference: reference.value ?? null,
      note: note.value ?? null,
    }
    const row = await prisma.weekPayment.upsert({
      where: { companyId_weekStart: { companyId: company.id, weekStart } },
      update: data,
      create: { ...data, weekStart, companyId: company.id },
    })

    const period = await getSinglePayPeriod(userId, company, body.weekStart)
    return NextResponse.json({
      success: true,
      data: { payment: serializePayment(row), status: weekPayStatus(period, today) },
    })
  } catch (error) {
    console.error('Error saving week payment:', error)
    return bad('Error al guardar el pago', 500)
  }
}

// POST - Marca como pagadas (por lo que calcula la app) todas las semanas
// terminadas sin pago hasta la que empieza en `through` (YYYY-MM-DD). Para
// ponerse al día con las semanas viejas que ya se cobraron.
export async function POST(request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id
    const { id } = await context.params
    const company = await getUserCompany(userId, id)
    if (!company) return bad('Compañía no encontrada', 404)

    const body = await request.json()
    if (!isDateKey(body.through)) return bad('Elige hasta qué semana')

    const today = getFloridaDateString()
    const owed = (await getPayPeriods(userId, company))
      .filter(p => p.start <= body.through && weekPayStatus(p, today).state === 'owed')
    const { count } = await prisma.weekPayment.createMany({
      data: owed.map(p => ({
        companyId: company.id,
        weekStart: dateKeyToUTC(p.start),
        amount: Math.round(p.totalPay * 100) / 100,
        paidOn: dateKeyToUTC(p.end < today ? p.end : today),
        note: 'Marcada como pagada sin datos del talonario',
      })),
      skipDuplicates: true,
    })
    return NextResponse.json({ success: true, data: { marked: count } })
  } catch (error) {
    console.error('Error marking weeks as paid:', error)
    return bad('Error al marcar las semanas', 500)
  }
}

// DELETE - Quita el pago registrado de una semana (?weekStart=YYYY-MM-DD)
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const { id } = await context.params
    const company = await getUserCompany(authResult.user.id, id)
    if (!company) return bad('Compañía no encontrada', 404)

    const weekStart = new URL(request.url).searchParams.get('weekStart')
    if (!isDateKey(weekStart)) return bad('Semana de pago inválida')

    const { count } = await prisma.weekPayment.deleteMany({ where: { companyId: company.id, weekStart: dateKeyToUTC(weekStart) } })
    if (count === 0) return bad('Esa semana no tiene pago registrado', 404)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting week payment:', error)
    return bad('Error al quitar el pago', 500)
  }
}
