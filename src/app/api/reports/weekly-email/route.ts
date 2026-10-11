import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getUserCompany } from '@/lib/company-store'
import { parseEmailList, splitEmails } from '@/lib/company-input'
import { dateKeyToUTC, getPayPeriod } from '@/lib/companies'
import { getSinglePayPeriod } from '@/lib/pay-periods'
import { buildWeeklyReportPdf, weeklyReportFileName } from '@/lib/weekly-report-pdf'
import { buildWeeklyReportEmail, lastCompletedWeekStart } from '@/lib/weekly-report-email'
import { isEmailConfigured, sendMail } from '@/lib/mailer'
import { getFloridaDateString } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
/** Envíos permitidos por usuario cada 24 horas (evita usar la app para spam) */
const MAX_SENDS_PER_DAY = 20

function weekStartFor(company: { weekStartsOn: number }, date: unknown, fallback: string): string {
  return typeof date === 'string' && DATE_KEY.test(date) ? getPayPeriod(date, company.weekStartsOn).start : fallback
}

// GET - Estado del reporte de una semana (?companyId, ?date; por defecto la
// última semana terminada): totales, destinatarios y envíos anteriores
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const company = await getUserCompany(user.id, searchParams.get('companyId'))
    if (!company) return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })

    const today = getFloridaDateString()
    const lastCompleted = lastCompletedWeekStart(company, today)
    const period = await getSinglePayPeriod(user.id, company, weekStartFor(company, searchParams.get('date'), lastCompleted))
    const deliveries = await prisma.reportDelivery.findMany({
      where: { companyId: company.id, weekStart: dateKeyToUTC(period.start) },
      orderBy: { sentAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        configured: isEmailConfigured(),
        recipients: company.reportEmails,
        senderEmail: user.email,
        lastCompletedStart: lastCompleted,
        currentStart: getPayPeriod(today, company.weekStartsOn).start,
        week: {
          start: period.start,
          end: period.end,
          totalSeconds: period.totalSeconds,
          overtimeSeconds: period.overtimeSeconds,
          totalPay: period.totalPay,
          entryCount: period.entries.length,
          hasRunningEntry: period.hasRunningEntry,
          finished: period.end < today,
        },
        deliveries: deliveries.map(d => ({ sentAt: d.sentAt, recipients: splitEmails(d.recipients) })),
      },
    })
  } catch (error) {
    console.error('Error getting weekly report status:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener el reporte' }, { status: 500 })
  }
}

// POST - Envía por correo el PDF de una semana de pago. Body: companyId, date
// (cualquier día de la semana; por defecto la última terminada), to (correos) y
// copyMe (copia al usuario). Los destinatarios quedan guardados en la compañía.
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const { user } = authResult

    const body = await request.json()
    const company = await getUserCompany(user.id, body.companyId)
    if (!company) return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })

    const recipients = parseEmailList(body.to ?? company.reportEmails)
    if (!recipients.ok) return NextResponse.json({ success: false, error: recipients.error }, { status: 400 })
    if (recipients.value.length === 0) {
      return NextResponse.json({ success: false, error: 'Agrega al menos un correo de destino' }, { status: 400 })
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { success: false, code: 'EMAIL_NOT_CONFIGURED', error: 'El envío automático de correos no está activado' },
        { status: 503 }
      )
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000)
    const sentToday = await prisma.reportDelivery.count({ where: { company: { userId: user.id }, sentAt: { gte: since } } })
    if (sentToday >= MAX_SENDS_PER_DAY) {
      return NextResponse.json({ success: false, error: 'Llegaste al límite de envíos de hoy. Intenta mañana.' }, { status: 429 })
    }

    const today = getFloridaDateString()
    const period = await getSinglePayPeriod(user.id, company, weekStartFor(company, body.date, lastCompletedWeekStart(company, today)))
    if (period.entries.length === 0) {
      return NextResponse.json({ success: false, error: 'Esa semana no tiene horas registradas' }, { status: 400 })
    }

    // La próxima vez basta con un toque: se guardan los destinatarios
    const saved = recipients.value.join(', ')
    if (saved !== company.reportEmails.join(', ')) {
      await prisma.company.update({ where: { id: company.id }, data: { reportEmails: saved } })
    }

    const senderName = user.name || user.email.split('@')[0]
    const pdf = await buildWeeklyReportPdf(period, company, { driverName: senderName })
    const email = buildWeeklyReportEmail(period, company, { name: senderName, email: user.email })
    const copy = body.copyMe !== false && !recipients.value.includes(user.email.toLowerCase())

    try {
      await sendMail({
        fromName: `${senderName} vía Meditron`,
        to: recipients.value,
        cc: copy ? [user.email] : undefined,
        replyTo: user.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: [{ filename: weeklyReportFileName(period, company), content: Buffer.from(pdf), contentType: 'application/pdf' }],
      })
    } catch (error) {
      console.error('Error sending weekly report email:', error)
      return NextResponse.json(
        { success: false, error: 'No se pudo enviar el correo. Revisa la configuración del correo e intenta de nuevo.' },
        { status: 502 }
      )
    }

    const delivery = await prisma.reportDelivery.create({
      data: { companyId: company.id, weekStart: dateKeyToUTC(period.start), recipients: saved },
    })

    return NextResponse.json({
      success: true,
      data: { sentAt: delivery.sentAt, recipients: recipients.value, copiedTo: copy ? user.email : null },
    })
  } catch (error) {
    console.error('Error sending weekly report:', error)
    return NextResponse.json({ success: false, error: 'Error al enviar el reporte' }, { status: 500 })
  }
}
