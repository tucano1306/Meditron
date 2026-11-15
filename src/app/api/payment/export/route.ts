import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { jobInclude, serializeJob } from '@/lib/payment-store'
import { jobEarned, methodLabel, ratePerHour, vehicleLabel } from '@/lib/payment-jobs'
import { csvCell, dayName, formatKeyUS, formatTime12, hoursDecimal, noteText } from '@/lib/report-format'
import { jobSearchOrder, jobSearchWhere, parseJobSearch, refineJobs } from '@/lib/payment-search'
import { getFloridaDateComponents, getFloridaDateString } from '@/lib/utils'

/** Día en Florida (YYYY-MM-DD) de un instante: de noche en UTC ya es el día siguiente */
function floridaKey(iso: string): string {
  const { year, month, day } = getFloridaDateComponents(new Date(iso))
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function fileName(from: string, to: string): string {
  if (from && to) return `trabajos-por-pago_${from}_al_${to}.csv`
  if (from) return `trabajos-por-pago_desde_${from}.csv`
  if (to) return `trabajos-por-pago_hasta_${to}.csv`
  return `trabajos-por-pago_al_${getFloridaDateString()}.csv`
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Filas como máximo en un archivo */
const MAX_ROWS = 10000

// GET - Exporta a CSV (Excel / Google Sheets) los trabajos por pago con los
// mismos filtros de la búsqueda (?from, ?to, ?q, ?companyId...). Sin fechas,
// exporta todas. El orden es el de la búsqueda; si no se pide, del más antiguo.
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response

    const { searchParams } = new URL(request.url)
    if (!searchParams.has('sort')) searchParams.set('sort', 'oldest')
    const search = parseJobSearch(searchParams)
    // Fechas que vienen pero no se entienden, o al revés: mejor avisar que exportar otra cosa
    const badDate = (key: 'from' | 'to') => searchParams.has(key) && searchParams.get(key) !== '' && !search[key]
    if (badDate('from') || badDate('to') || (search.from && search.to && search.from > search.to)) {
      return NextResponse.json({ success: false, error: 'Rango de fechas inválido' }, { status: 400 })
    }

    const rows = await prisma.paymentEntry.findMany({
      where: jobSearchWhere(authResult.user.id, search),
      include: jobInclude,
      orderBy: jobSearchOrder(search),
      take: MAX_ROWS,
    })
    const jobs = refineJobs(rows.map(serializeJob), search)

    const header = ['Fecha', 'Día', 'Inicio', 'Fin', 'Horas', 'Compañía', 'Cliente', 'Trabajo #', 'Vehículo', 'Pago', 'Propina', 'Total', 'Por hora', 'Método', 'Estado', 'Cobrado el', 'Notas']
    const lines = jobs.map(job => {
      const earned = jobEarned(job)
      return [
        formatKeyUS(job.date),
        dayName(job.date),
        formatTime12(job.startTime),
        formatTime12(job.endTime),
        hoursDecimal(job.duration),
        job.company?.name ?? '',
        job.client,
        job.jobNumber,
        vehicleLabel(job.vehicle),
        job.amount.toFixed(2),
        job.tip.toFixed(2),
        earned.toFixed(2),
        ratePerHour(earned, job.duration).toFixed(2),
        methodLabel(job.paymentMethod),
        job.paymentStatus === 'pending' ? 'Por cobrar' : 'Cobrado',
        job.paidAt ? formatKeyUS(floridaKey(job.paidAt)) : '',
        noteText(job.notes),
      ].map(csvCell).join(',')
    })

    // BOM para que Excel reconozca los acentos
    const csv = `﻿${[header.join(','), ...lines].join('\r\n')}`
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName(search.from, search.to)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exporting payment jobs:', error)
    return NextResponse.json({ success: false, error: 'Error al exportar' }, { status: 500 })
  }
}
