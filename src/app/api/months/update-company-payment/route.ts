import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { intInRange, optionalMoney } from '@/lib/input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PUT - Actualizar el pago de la compañía para un mes
export async function PUT(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const body = await request.json()
    const year = intInRange(body.year, 2000, 2100)
    const month = intInRange(body.month, 1, 12)
    const paid = optionalMoney(body.companyPaid, 'El pago de la compañía')

    if (year === null || month === null) {
      return NextResponse.json(
        { success: false, error: 'Año o mes inválido' },
        { status: 400 }
      )
    }
    if (!paid.ok) {
      return NextResponse.json({ success: false, error: paid.error }, { status: 400 })
    }
    const companyPaid = paid.value ?? null

    // Buscar o crear el resumen mensual
    const monthSummary = await prisma.monthSummary.upsert({
      where: {
        year_month_userId: {
          year,
          month,
          userId
        }
      },
      update: {
        companyPaid
      },
      create: {
        year,
        month,
        userId,
        companyPaid,
        totalHours: 0,
        earnings: 0
      }
    })

    return NextResponse.json({
      success: true,
      data: monthSummary
    })
  } catch (error) {
    console.error('Error updating month company payment:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar el pago de la compañía' },
      { status: 500 }
    )
  }
}
