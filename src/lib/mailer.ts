// Envío de correos desde el servidor. Se configura con variables de entorno:
//
//   Gmail (lo más simple):  GMAIL_USER + GMAIL_APP_PASSWORD
//     (contraseña de aplicación de Google: myaccount.google.com/apppasswords)
//   Cualquier SMTP:         SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS,
//                           SMTP_SECURE=true para el puerto 465
//   Opcional:               EMAIL_FROM (remitente; por defecto la cuenta)
//
// Sin configuración, isEmailConfigured() es false y la app ofrece compartir el
// PDF desde el teléfono en vez de enviarlo.

import nodemailer, { type Transporter } from 'nodemailer'

let transporter: Transporter | null = null

function senderAddress(): string | null {
  return process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER || null
}

export function isEmailConfigured(): boolean {
  const gmail = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  return gmail || Boolean(process.env.SMTP_HOST && senderAddress())
}

function getTransporter(): Transporter {
  if (transporter) return transporter
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      // Las contraseñas de aplicación de Google se muestran con espacios
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replaceAll(' ', '') },
    })
  } else {
    const port = Number(process.env.SMTP_PORT || 587)
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  }
  return transporter
}

export interface OutgoingMail {
  /** Nombre que se ve como remitente ("Leo vía Meditron") */
  fromName: string
  to: string[]
  cc?: string[]
  replyTo?: string
  subject: string
  html: string
  text: string
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}

export async function sendMail(mail: OutgoingMail): Promise<void> {
  const from = senderAddress()
  if (!isEmailConfigured() || !from) throw new Error('El envío de correos no está configurado')
  await getTransporter().sendMail({
    from: { name: mail.fromName, address: from },
    to: mail.to,
    cc: mail.cc,
    replyTo: mail.replyTo,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: mail.attachments,
  })
}
