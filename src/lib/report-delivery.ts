// Envío del reporte semanal por correo y su registro. Lo usan el botón de la
// app y el envío automático semanal (cron).

import { prisma } from './prisma'
import { dateKeyToUTC, type Company } from './companies'
import type { PayPeriodSummary } from './pay-periods'
import { buildWeeklyReportPdf, weeklyReportFileName } from './weekly-report-pdf'
import { buildWeeklyReportEmail } from './weekly-report-email'
import { reportIdentity } from './report-identity'
import { sendMail } from './mailer'

/** Envíos permitidos por usuario cada 24 horas (evita usar la app para spam) */
export const MAX_SENDS_PER_DAY = 20

export async function sendsInLastDay(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000)
  return prisma.reportDelivery.count({ where: { company: { userId }, sentAt: { gte: since } } })
}

export async function wasWeekSent(companyId: string, weekStart: string): Promise<boolean> {
  const sent = await prisma.reportDelivery.findFirst({
    where: { companyId, weekStart: dateKeyToUTC(weekStart) },
    select: { id: true },
  })
  return sent !== null
}

interface DeliveryInput {
  user: { email: string; name: string | null; businessName: string | null }
  company: Company
  period: PayPeriodSummary
  recipients: string[]
  /** Copia al usuario (si no es ya destinatario) */
  copyMe: boolean
  automatic: boolean
}

/** Arma el PDF y el correo, lo envía y lo registra. Lanza un error si el envío falla. */
export async function deliverWeeklyReport({ user, company, period, recipients, copyMe, automatic }: DeliveryInput) {
  const identity = reportIdentity(user)
  const pdf = await buildWeeklyReportPdf(period, company, identity)
  const email = buildWeeklyReportEmail(period, company, { ...identity, email: user.email })
  const copy = copyMe && !recipients.includes(user.email.toLowerCase())

  await sendMail({
    fromName: `${identity.label} vía Meditron`,
    to: recipients,
    cc: copy ? [user.email] : undefined,
    replyTo: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: [{ filename: weeklyReportFileName(period, company, identity), content: Buffer.from(pdf), contentType: 'application/pdf' }],
  })

  const delivery = await prisma.reportDelivery.create({
    data: { companyId: company.id, weekStart: dateKeyToUTC(period.start), recipients: recipients.join(', '), automatic },
  })
  return { sentAt: delivery.sentAt, copiedTo: copy ? user.email : null }
}
