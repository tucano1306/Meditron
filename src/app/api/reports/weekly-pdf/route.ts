import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth-utils'
import { isCompanyId } from '@/lib/companies'
import { getSinglePayPeriod } from '@/lib/pay-periods'
import { buildWeeklyReportPdf, weeklyReportFileName } from '@/lib/weekly-report-pdf'
import { getFloridaDateString, HOURLY_RATE } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - PDF de la semana de pago que contiene ?date=YYYY-MM-DD
// (Tecnofuel: domingo a sábado; Larry's: lunes a domingo). ?download=1 lo descarga.
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const company = searchParams.get('company')
    if (!isCompanyId(company)) {
      return NextResponse.json({ success: false, error: 'Compañía inválida' }, { status: 400 })
    }
    const dateParam = searchParams.get('date')
    const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getFloridaDateString()

    const { user } = authResult
    const hourlyRate = user.hourlyRate ?? HOURLY_RATE
    const period = await getSinglePayPeriod(user.id, company, hourlyRate, date)
    const pdf = await buildWeeklyReportPdf(period, { driverName: user.name, hourlyRate })

    const disposition = searchParams.get('download') === '1' ? 'attachment' : 'inline'
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${weeklyReportFileName(period)}"`,
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
