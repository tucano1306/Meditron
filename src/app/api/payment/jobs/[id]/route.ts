import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { jobInclude, parseJobInput, serializeJob, withDerivedFields } from '@/lib/payment-store'
import { rebalanceDays, resolveJobCompany } from '@/lib/pay-company-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

async function findOwnJob(userId: string, id: string) {
  return prisma.paymentEntry.findFirst({ where: { id, userId, completed: true } })
}

// PATCH - Editar un trabajo terminado (solo los campos que vienen)
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const { id } = await context.params
    const current = await findOwnJob(userId, id)
    if (!current) return NextResponse.json({ success: false, error: 'Trabajo no encontrado' }, { status: 404 })

    const body = await request.json()
    const parsed = parseJobInput(body, true)
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    const choice = await resolveJobCompany(userId, body, current)
    if (!choice.ok) return NextResponse.json({ success: false, error: choice.error }, { status: 400 })

    // Si deja de ser automático, necesita un pago escrito
    const { companyId, amountAuto } = choice.value
    const touchesPay = body.amount !== undefined || body.autoPay !== undefined || body.companyId !== undefined
    const amount = typeof parsed.value.amount === 'number' ? parsed.value.amount : current.amount ?? 0
    if (touchesPay && !amountAuto && amount <= 0) {
      return NextResponse.json({ success: false, error: 'Escribe cuánto te pagaron' }, { status: 400 })
    }

    // Al pasar a automático, o a otro día o compañía, el pago lo vuelve a poner
    // la compañía (no se arrastra un monto escrito a mano ni el de otro día)
    const date = parsed.value.date instanceof Date ? parsed.value.date : current.date
    const resetAuto = amountAuto && (!current.amountAuto || companyId !== current.companyId || date.getTime() !== current.date.getTime())

    const row = await prisma.$transaction(async tx => {
      const updated = await tx.paymentEntry.update({
        where: { id },
        data: {
          ...withDerivedFields(parsed.value, current),
          companyId,
          amountAuto,
          ...(resetAuto ? { amount: 0, hourlyRate: 0 } : {}),
        },
      })
      // El día de antes y el de ahora (por si cambió de fecha o de compañía)
      await rebalanceDays(tx, userId, [
        { companyId: current.companyId, date: current.date },
        { companyId: updated.companyId, date: updated.date },
      ])
      return tx.paymentEntry.findUniqueOrThrow({ where: { id }, include: jobInclude })
    })
    return NextResponse.json({ success: true, data: serializeJob(row) })
  } catch (error) {
    console.error('Error updating payment job:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar el trabajo' }, { status: 500 })
  }
}

// DELETE - Eliminar un trabajo terminado (el pago del día pasa a otro registro de ese día)
export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const { id } = await context.params
    const current = await findOwnJob(userId, id)
    if (!current) return NextResponse.json({ success: false, error: 'Trabajo no encontrado' }, { status: 404 })

    await prisma.$transaction(async tx => {
      await tx.paymentEntry.delete({ where: { id } })
      await rebalanceDays(tx, userId, [{ companyId: current.companyId, date: current.date }])
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting payment job:', error)
    return NextResponse.json({ success: false, error: 'Error al eliminar el trabajo' }, { status: 500 })
  }
}
