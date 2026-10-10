import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth-utils'
import { getUserCompany } from '@/lib/company-store'
import { getPayPeriods, getSinglePayPeriod } from '@/lib/pay-periods'
import { getFloridaDateString } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Semanas de pago de una compañía (?companyId=) con su desglose de pago
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const company = await getUserCompany(userId, new URL(request.url).searchParams.get('companyId'))
    if (!company) {
      return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })
    }

    const [periods, current] = await Promise.all([
      getPayPeriods(userId, company),
      getSinglePayPeriod(userId, company, getFloridaDateString()),
    ])

    return NextResponse.json({
      success: true,
      data: { company, current, periods },
    })
  } catch (error) {
    console.error('Error getting pay periods:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener las semanas de pago' },
      { status: 500 }
    )
  }
}
