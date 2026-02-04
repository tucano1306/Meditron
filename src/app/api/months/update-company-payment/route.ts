import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'

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
    const { year, month, companyPaid } = await request.json()

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month are required' },
        { status: 400 }
      )
    }

    // Buscar o crear el resumen mensual
    const monthSummary = await prisma.monthSummary.upsert({
      where: {
        year_month_userId: {
          year: Number(year),
          month: Number(month),
          userId
        }
      },
      update: {
        companyPaid: companyPaid === null ? null : Number(companyPaid)
      },
      create: {
        year: Number(year),
        month: Number(month),
        userId,
        companyPaid: companyPaid === null ? null : Number(companyPaid),
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
