import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth-utils'
import { COMPANIES, isCompanyId } from '@/lib/companies'
import { getPayPeriods } from '@/lib/pay-periods'
import { dayName, formatKeyUS, formatTime12, hoursDecimal, noteWithoutTag } from '@/lib/report-format'
import { HOURLY_RATE } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// GET - Exporta a CSV los trabajos de una compañía entre ?from y ?to (YYYY-MM-DD)
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
    const from = searchParams.get('from') ?? ''
    const to = searchParams.get('to') ?? ''
    if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) {
      return NextResponse.json({ success: false, error: 'Rango de fechas inválido' }, { status: 400 })
    }

    const { user } = authResult
    const periods = await getPayPeriods(user.id, company, user.hourlyRate ?? HOURLY_RATE, { from, to })

    const header = [
      'Compañía', 'Semana de pago', 'Fecha', 'Día', 'Entrada', 'Salida', 'Horas',
      'Horas regulares', 'Horas extra', 'Monto', 'Job #', 'Vehículo', 'Servicio', 'Pagado empresa', 'Nota',
    ]
    const rows: string[][] = []
    for (const period of [...periods].reverse()) {
      for (const e of period.entries) {
        const day = e.date.slice(0, 10)
        // Las semanas se agrupan completas; aquí solo van los días del rango pedido
        if (day < from || day > to) continue
        rows.push([
          COMPANIES[company].name,
          `${period.start} al ${period.end}`,
          formatKeyUS(day),
          dayName(day),
          formatTime12(e.startTime),
          e.endTime ? formatTime12(e.endTime) : '',
          hoursDecimal(e.duration ?? 0),
          hoursDecimal(e.regularSeconds),
          hoursDecimal(e.overtimeSeconds),
          e.amount.toFixed(2),
          e.jobNumber ?? '',
          e.vehicle ?? '',
          e.serviceType ?? '',
          e.companyPaid == null ? '' : e.companyPaid.toFixed(2),
          noteWithoutTag(e.observation),
        ])
      }
    }

    // BOM para que Excel abra bien los acentos
    const csv = '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
    const prefix = company === 'tecnofuel' ? 'Tecnofuel' : 'Larrys-Private'
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${prefix}_${from}_al_${to}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exporting CSV:', error)
    return NextResponse.json(
      { success: false, error: 'Error al exportar' },
      { status: 500 }
    )
  }
}
