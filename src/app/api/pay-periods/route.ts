import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth-utils'
import { COMPANIES, isCompanyId } from '@/lib/companies'
import { getPayPeriods, getSinglePayPeriod } from '@/lib/pay-periods'
import { getFloridaDateString, HOURLY_RATE } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Semanas de pago de una compañía (?company=tecnofuel|larrys)
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const company = new URL(request.url).searchParams.get('company')
    if (!isCompanyId(company)) {
      return NextResponse.json({ success: false, error: 'Compañía inválida' }, { status: 400 })
    }

    const userId = authResult.user.id
    const hourlyRate = authResult.user.hourlyRate ?? HOURLY_RATE
    const [periods, current] = await Promise.all([
      getPayPeriods(userId, company, hourlyRate),
      getSinglePayPeriod(userId, company, hourlyRate, getFloridaDateString()),
    ])

    return NextResponse.json({
      success: true,
      data: { company: COMPANIES[company], current, periods },
    })
  } catch (error) {
    console.error('Error getting pay periods:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener las semanas de pago' },
      { status: 500 }
    )
  }
}
