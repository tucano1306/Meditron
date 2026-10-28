import { NextRequest, NextResponse } from 'next/server'
import { buildTimesheet, floridaDateKey, orgAccess, orgWeek } from '@/lib/org-server'
import { computeOvertime } from '@/lib/companies'
import { isDateKey } from '@/lib/input'
import { paidSeconds } from '@/lib/org-shared'
import { csvCell, dayName, formatKeyUS, formatTime12, hoursDecimal } from '@/lib/report-format'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ orgId: string }> }

function fileSlug(text: string): string {
  return text.normalize('NFD').replaceAll(/[̀-ͯ]/g, '').replaceAll(/[^a-zA-Z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'empresa'
}

// GET - Horas, overtime y pago de cada empleado en una semana de pago.
// ?week= (cualquier día de la semana; por defecto la actual), ?format=csv para nómina
export async function GET(request: NextRequest, context: Context) {
  try {
    const { orgId } = await context.params
    const access = await orgAccess(orgId, { admin: true })
    if (!access.ok) return access.response
    const { org } = access

    const { searchParams } = new URL(request.url)
    const param = searchParams.get('week')
    const week = orgWeek(org, isDateKey(param) ? param : floridaDateKey(new Date()))
    const sheet = await buildTimesheet(org, week.start)

    if (searchParams.get('format') !== 'csv') {
      return NextResponse.json({ success: true, data: sheet })
    }

    const rows: string[][] = [[
      'Empleado', 'Correo', 'Fecha', 'Día', 'Entrada', 'Salida', 'Break (min)', 'Horas', 'Regular', 'Extra',
      'Tarifa', 'Monto', 'Distancia entrada (m)', 'Distancia salida (m)', 'Origen', 'Editado por admin',
    ]]
    for (const w of sheet.members) {
      const closed = w.shifts.filter(s => s.clockOut)
      const byShift = computeOvertime(
        closed.map(s => ({ id: s.id, startTime: s.clockIn, duration: paidSeconds(s) })),
        { baseRate: w.member.hourlyRate, thresholdHours: org.overtimeAfterHours, multiplier: org.overtimeMultiplier },
      ).byEntry
      for (const s of w.shifts) {
        const pay = byShift[s.id]
        rows.push([
          w.member.name, w.member.email, formatKeyUS(s.date), dayName(s.date),
          formatTime12(s.clockIn), s.clockOut ? formatTime12(s.clockOut) : 'SIN SALIDA',
          String(Math.round(s.breakSeconds / 60)), hoursDecimal(paidSeconds(s)),
          pay ? hoursDecimal(pay.regularSeconds) : '', pay ? hoursDecimal(pay.overtimeSeconds) : '',
          w.member.hourlyRate.toFixed(2), pay ? pay.amount.toFixed(2) : '',
          s.inDistance === null ? '' : String(Math.round(s.inDistance)),
          s.outDistance === null ? '' : String(Math.round(s.outDistance)),
          s.source === 'admin' ? 'Administrador' : 'Marcado', s.edited ? 'Sí' : 'No',
        ])
      }
    }
    rows.push([], ['Resumen', '', '', '', '', '', '', 'Horas', 'Regular', 'Extra', 'Tarifa', 'Total'])
    for (const w of sheet.members) {
      rows.push([
        w.member.name, w.member.email, '', '', '', '', '',
        hoursDecimal(w.totalSeconds), hoursDecimal(w.regularSeconds), hoursDecimal(w.overtimeSeconds),
        w.member.hourlyRate.toFixed(2), w.totalPay.toFixed(2),
      ])
    }

    const csv = String.fromCharCode(0xfeff) + rows.map(r => r.map(csvCell).join(',')).join('\r\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileSlug(org.name)}_horas_${week.start}_al_${week.end}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error building timesheet:', error)
    return NextResponse.json({ success: false, error: 'Error al cargar las horas' }, { status: 500 })
  }
}
