import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { isDateKey } from '@/lib/input'
import { companyStats, parsePayCompanyInput, rebalanceDayPay, serializePayCompany } from '@/lib/pay-company-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

// PATCH - Editar una compañía. Si paga por día y cambia el monto, con
// `applyFrom` (YYYY-MM-DD) también se actualizan los días ya anotados desde esa fecha
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const { id } = await context.params
    const current = await prisma.payCompany.findFirst({ where: { id, userId } })
    if (!current) return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })

    const body = await request.json()
    const parsed = parsePayCompanyInput(body, true, current)
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    if (body.applyFrom !== undefined && body.applyFrom !== null && !isDateKey(body.applyFrom)) {
      return NextResponse.json({ success: false, error: 'Revisa la fecha' }, { status: 400 })
    }

    const result = await prisma.$transaction(async tx => {
      const row = await tx.payCompany.update({ where: { id }, data: parsed.value })
      let updatedDays = 0
      if (row.payType !== 'per_day') {
        // Ya no paga por día: los pagos quedan como están, pero dejan de ser automáticos
        await tx.paymentEntry.updateMany({ where: { userId, companyId: id, amountAuto: true }, data: { amountAuto: false } })
      } else if (typeof body.applyFrom === 'string' && row.rate) {
        const days = await tx.paymentEntry.findMany({
          where: { userId, companyId: id, amountAuto: true, completed: true, date: { gte: new Date(`${body.applyFrom}T00:00:00Z`) } },
          distinct: ['date'],
          select: { date: true },
        })
        for (const { date } of days) {
          if (await rebalanceDayPay(tx, userId, id, date, row.rate)) updatedDays += 1
        }
      }
      return { row, updatedDays }
    })

    const stats = await companyStats(userId)
    return NextResponse.json({ success: true, data: { company: serializePayCompany(result.row, stats.get(id)), updatedDays: result.updatedDays } })
  } catch (error) {
    console.error('Error updating pay company:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar la compañía' }, { status: 500 })
  }
}

// DELETE - Borrar una compañía sin trabajos (las que tienen historial se archivan)
export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const { id } = await context.params
    const current = await prisma.payCompany.findFirst({ where: { id, userId } })
    if (!current) return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })

    const jobs = await prisma.paymentEntry.count({ where: { userId, companyId: id } })
    if (jobs > 0) {
      return NextResponse.json({
        success: false,
        error: `Tiene ${jobs} ${jobs === 1 ? 'trabajo' : 'trabajos'} registrados. Archívala para ocultarla sin perder su historial.`,
      }, { status: 409 })
    }
    await prisma.payCompany.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting pay company:', error)
    return NextResponse.json({ success: false, error: 'Error al borrar la compañía' }, { status: 500 })
  }
}
