import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { isPaymentMethod } from '@/lib/payment-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST - Marca varios trabajos como cobrados o por cobrar de una vez.
// Body: ids, status (paid|pending) y, al cobrar, el método de pago (opcional)
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response

    const { ids, status, paymentMethod } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every(id => typeof id === 'string')) {
      return NextResponse.json({ success: false, error: 'Elige al menos un trabajo' }, { status: 400 })
    }
    if (status !== 'paid' && status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Estado de cobro inválido' }, { status: 400 })
    }
    if (paymentMethod !== undefined && paymentMethod !== null && !isPaymentMethod(paymentMethod)) {
      return NextResponse.json({ success: false, error: 'Método de pago inválido' }, { status: 400 })
    }

    const result = await prisma.paymentEntry.updateMany({
      where: { id: { in: ids }, userId: authResult.user.id, completed: true },
      data: status === 'paid'
        ? { paymentStatus: 'paid', paidAt: new Date(), ...(paymentMethod ? { paymentMethod } : {}) }
        : { paymentStatus: 'pending', paidAt: null },
    })
    return NextResponse.json({ success: true, data: { updated: result.count } })
  } catch (error) {
    console.error('Error collecting payment jobs:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar los cobros' }, { status: 500 })
  }
}
