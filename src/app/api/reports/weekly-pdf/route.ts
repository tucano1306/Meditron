import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth-utils'
import { getUserCompany } from '@/lib/company-store'
import { getSinglePayPeriod } from '@/lib/pay-periods'
import { buildWeeklyReportPdf, weeklyReportFileName } from '@/lib/weekly-report-pdf'
import { reportIdentity } from '@/lib/report-identity'
import { getFloridaDateString } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - PDF de la semana de pago de una compañía (?companyId) que contiene
// ?date=YYYY-MM-DD. ?download=1 lo descarga en vez de abrirlo.
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const { user } = authResult
    const company = await getUserCompany(user.id, searchParams.get('companyId'))
    if (!company) {
      return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })
    }
    const dateParam = searchParams.get('date')
    const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getFloridaDateString()

    const period = await getSinglePayPeriod(user.id, company, date)
    const identity = reportIdentity(user)
    const pdf = await buildWeeklyReportPdf(period, company, identity)

    const disposition = searchParams.get('download') === '1' ? 'attachment' : 'inline'
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${weeklyReportFileName(period, company, identity)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating weekly PDF:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar el PDF' },
      { status: 500 }
    )
  }
}
