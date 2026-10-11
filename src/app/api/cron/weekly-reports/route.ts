import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserCompanies } from '@/lib/company-store'
import { addDaysToKey, getPayPeriod } from '@/lib/companies'
import { getSinglePayPeriod } from '@/lib/pay-periods'
import { lastCompletedWeekStart } from '@/lib/weekly-report-email'
import { deliverWeeklyReport, MAX_SENDS_PER_DAY, sendsInLastDay, wasWeekSent } from '@/lib/report-delivery'
import { isEmailConfigured } from '@/lib/mailer'
import { getFloridaDateString } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET - Envío automático semanal (Vercel Cron, una vez al día por la mañana).
// Para cada compañía con el envío automático activado manda el reporte de la
// semana que acaba de terminar: el día en que empieza la semana nueva o, si ese
// día no se pudo (p. ej. el turno seguía en curso), al día siguiente. Nunca
// manda dos veces la misma semana ni semanas viejas.
//
// Con la variable CRON_SECRET, Vercel manda "Authorization: Bearer <secreto>" y
// solo esas llamadas se aceptan. Sin ella, repetir la llamada no hace daño: lo
// que ya se envió no se vuelve a enviar.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, failed: 0, note: 'Correo no configurado' })
  }

  const today = getFloridaDateString()
  const totals = { sent: 0, skipped: 0, failed: 0 }

  const owners = await prisma.company.findMany({
    where: { autoSendReport: true, archived: false, reportEmails: { not: null } },
    select: { userId: true },
    distinct: ['userId'],
  })

  for (const { userId } of owners) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!user) continue
    const companies = (await getUserCompanies(userId)).filter(c => c.autoSendReport && !c.archived && c.reportEmails.length > 0)

    for (const company of companies) {
      const newWeekStart = getPayPeriod(today, company.weekStartsOn).start
      const weekStart = lastCompletedWeekStart(company, today)
      // Solo el primer o segundo día de la semana nueva
      const onTime = today === newWeekStart || today === addDaysToKey(newWeekStart, 1)
      if (!onTime || await wasWeekSent(company.id, weekStart)) {
        totals.skipped += 1
        continue
      }
      const period = await getSinglePayPeriod(userId, company, weekStart)
      if (period.entries.length === 0 || period.hasRunningEntry || await sendsInLastDay(userId) >= MAX_SENDS_PER_DAY) {
        totals.skipped += 1
        continue
      }
      try {
        await deliverWeeklyReport({ user, company, period, recipients: company.reportEmails, copyMe: true, automatic: true })
        totals.sent += 1
      } catch (error) {
        console.error(`Automatic weekly report failed for company ${company.id}:`, error)
        totals.failed += 1
      }
    }
  }

  return NextResponse.json({ success: true, date: today, ...totals })
}
