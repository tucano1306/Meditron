import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { serializeJob } from '@/lib/payment-store'
import { jobEarned, methodLabel, ratePerHour, vehicleLabel } from '@/lib/payment-jobs'
import { csvCell, dayName, formatKeyUS, formatTime12, hoursDecimal, noteText } from '@/lib/report-format'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

// GET - Exporta a CSV (Excel / Google Sheets) los trabajos por pago entre ?from y ?to
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') ?? ''
    const to = searchParams.get('to') ?? ''
    if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) {
      return NextResponse.json({ success: false, error: 'Rango de fechas inválido' }, { status: 400 })
    }

    const rows = await prisma.paymentEntry.findMany({
      where: {
        userId: authResult.user.id,
        completed: true,
        date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
      },
      orderBy: { startTime: 'asc' },
    })

    const header = ['Fecha', 'Día', 'Inicio', 'Fin', 'Horas', 'Cliente', 'Trabajo #', 'Vehículo', 'Pago', 'Propina', 'Total', 'Por hora', 'Método', 'Estado', 'Cobrado el', 'Notas']
    const lines = rows.map(serializeJob).map(job => {
      const earned = jobEarned(job)
      return [
        formatKeyUS(job.date),
        dayName(job.date),
        formatTime12(job.startTime),
        formatTime12(job.endTime),
        hoursDecimal(job.duration),
        job.client,
        job.jobNumber,
        vehicleLabel(job.vehicle),
        job.amount.toFixed(2),
        job.tip.toFixed(2),
        earned.toFixed(2),
        ratePerHour(earned, job.duration).toFixed(2),
        methodLabel(job.paymentMethod),
        job.paymentStatus === 'pending' ? 'Por cobrar' : 'Cobrado',
        job.paidAt ? formatKeyUS(job.paidAt.slice(0, 10)) : '',
        noteText(job.notes),
      ].map(csvCell).join(',')
    })

    // BOM para que Excel reconozca los acentos
    const csv = `﻿${[header.join(','), ...lines].join('\r\n')}`
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="trabajos-por-pago_${from}_al_${to}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exporting payment jobs:', error)
    return NextResponse.json({ success: false, error: 'Error al exportar' }, { status: 500 })
  }
}
