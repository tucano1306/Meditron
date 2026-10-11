// Correo del reporte semanal: asunto, cuerpo HTML (estilos en línea para que se
// vea bien en Gmail/Outlook) y texto plano. El detalle completo va en el PDF.

import { addDaysToKey, getPayPeriod, overtimeRulesOf, tracksJobDetails, type Company } from './companies'
import type { PayPeriodSummary } from './pay-periods'
import { dailyTotals, formatKeyLong, formatKeyShort, formatTime12, hoursDecimal, money } from './report-format'
import { formatRange } from './display'

/** Semana de pago terminada más reciente (la anterior a la que contiene `today`) */
export function lastCompletedWeekStart(company: Company, today: string): string {
  const current = getPayPeriod(today, company.weekStartsOn)
  return getPayPeriod(addDaysToKey(current.start, -1), company.weekStartsOn).start
}

/** "4–10 oct 2026" */
export function weekTitle(period: { start: string; end: string }): string {
  return `${formatRange(period.start, period.end)} ${period.end.slice(0, 4)}`
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

interface Sender {
  name: string
  email: string
}

const INK = '#37352f'
const MUTED = '#787774'
const LINE = '#e9e9e7'

export function buildWeeklyReportEmail(period: PayPeriodSummary, company: Company, sender: Sender) {
  const title = weekTitle(period)
  const kind = tracksJobDetails(company) ? 'trabajos' : 'horas'
  const subject = `Reporte semanal de ${kind} · ${company.name} · ${title} · ${sender.name}`
  const ot = overtimeRulesOf(period.rule)
  const days = dailyTotals(period)
  const workedDays = days.filter(d => d.seconds > 0).length
  const periodLabel = `${formatKeyLong(period.start)} – ${formatKeyLong(period.end)}`

  // ── Totales ──
  const totals: [string, string][] = [['Horas totales', `${hoursDecimal(period.totalSeconds)} h`]]
  if (ot) {
    totals.push(
      [`Regulares × ${money(ot.baseRate)}`, `${hoursDecimal(period.regularSeconds)} h`],
      [`Extra ${ot.multiplier}x × ${money(ot.baseRate * ot.multiplier)}`, `${hoursDecimal(period.overtimeSeconds)} h`],
    )
  }
  totals.push(['Días trabajados', String(workedDays)], [kind === 'trabajos' ? 'Trabajos' : 'Turnos', String(period.entries.length)])

  const cell = (text: string, align: 'left' | 'right' = 'left', bold = false, color = INK) =>
    `<td style="padding:7px 10px;border-bottom:1px solid ${LINE};text-align:${align};color:${color};${bold ? 'font-weight:600;' : ''}">${text}</td>`
  const head = (labels: [string, 'left' | 'right'][]) =>
    `<tr>${labels.map(([l, a]) => `<th style="padding:7px 10px;background:${INK};color:#fff;font-size:12px;font-weight:600;text-align:${a};">${l}</th>`).join('')}</tr>`

  const dayRows = days.map(d => {
    const worked = d.seconds > 0
    const color = worked ? INK : '#b4b4b0'
    return `<tr>${cell(escapeHtml(formatKeyShort(d.date)), 'left', false, color)}${cell(worked ? String(d.entries) : '—', 'right', false, color)}${cell(worked ? hoursDecimal(d.seconds) : '—', 'right', false, color)}${cell(worked ? money(d.amount) : '—', 'right', false, color)}</tr>`
  }).join('')

  const entryRows = period.entries.map(e => {
    const job = company.trackJobNumber ? cell(escapeHtml(e.jobNumber ? `#${e.jobNumber}` : '—')) : ''
    return `<tr>${cell(escapeHtml(formatKeyShort(e.date.slice(0, 10))))}${job}${cell(formatTime12(e.startTime))}${cell(e.endTime ? formatTime12(e.endTime) : '—')}${cell(hoursDecimal(e.duration ?? 0), 'right')}${cell(money(e.amount), 'right')}</tr>`
  }).join('')

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#f7f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f5;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${LINE};">
  <tr><td style="height:6px;background:${escapeHtml(company.color)};"></td></tr>
  <tr><td style="padding:24px 28px 8px;">
    <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};">Reporte semanal de ${kind}</div>
    <div style="font-size:24px;font-weight:700;margin-top:4px;">${escapeHtml(company.name)}</div>
    <div style="font-size:14px;color:${MUTED};margin-top:4px;">${escapeHtml(periodLabel)}</div>
  </td></tr>
  <tr><td style="padding:12px 28px 0;font-size:14px;line-height:1.55;">
    Hola, adjunto el reporte de ${kind} de <strong>${escapeHtml(sender.name)}</strong> de la semana del ${escapeHtml(formatKeyLong(period.start))} al ${escapeHtml(formatKeyLong(period.end))}.
  </td></tr>
  <tr><td style="padding:20px 28px 4px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:10px;background:#f7f7f5;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:.05em;">Total a cobrar</div>
        <div style="font-size:30px;font-weight:700;color:#0f7b6c;margin-top:2px;">${money(period.totalPay)}</div>
      </td><td style="padding:16px 18px;text-align:right;">
        <div style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:.05em;">Horas</div>
        <div style="font-size:30px;font-weight:700;margin-top:2px;">${hoursDecimal(period.totalSeconds)}</div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:12px 28px 0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;border-collapse:collapse;">
      ${totals.map(([label, value]) => `<tr>${cell(escapeHtml(label), 'left', false, MUTED)}${cell(escapeHtml(value), 'right', true)}</tr>`).join('')}
    </table>
  </td></tr>
  <tr><td style="padding:24px 28px 0;">
    <div style="font-size:15px;font-weight:700;margin-bottom:8px;">Resumen por día</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;border-collapse:collapse;">
      ${head([['Día', 'left'], [kind === 'trabajos' ? 'Trabajos' : 'Turnos', 'right'], ['Horas', 'right'], ['Monto', 'right']])}
      ${dayRows}
      <tr>${cell('Total', 'left', true)}${cell(String(period.entries.length), 'right', true)}${cell(hoursDecimal(period.totalSeconds), 'right', true)}${cell(money(period.totalPay), 'right', true)}</tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px 28px 0;">
    <div style="font-size:15px;font-weight:700;margin-bottom:8px;">Detalle</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;border-collapse:collapse;">
      ${head([['Fecha', 'left'], ...(company.trackJobNumber ? [['Job #', 'left'] as [string, 'left']] : []), ['Entrada', 'left'], ['Salida', 'left'], ['Horas', 'right'], ['Monto', 'right']])}
      ${entryRows}
    </table>
    <div style="font-size:12px;color:${MUTED};margin-top:10px;">El PDF adjunto tiene el detalle completo de cada ${kind === 'trabajos' ? 'trabajo' : 'turno'}.</div>
  </td></tr>
  <tr><td style="padding:28px;font-size:12px;color:${MUTED};line-height:1.5;border-top:1px solid ${LINE};margin-top:24px;">
    Enviado por ${escapeHtml(sender.name)} (${escapeHtml(sender.email)}) con Meditron. Si respondes a este correo, le llega a ${escapeHtml(sender.name)}.
  </td></tr>
</table>
</td></tr></table>
</body></html>`

  const text = [
    `Reporte semanal de ${kind} — ${company.name}`,
    periodLabel,
    '',
    `Hola, adjunto el reporte de ${kind} de ${sender.name}.`,
    '',
    `Total a cobrar: ${money(period.totalPay)}`,
    ...totals.map(([label, value]) => `${label}: ${value}`),
    '',
    'Resumen por día:',
    ...days.map(d => `  ${formatKeyShort(d.date)}: ${d.seconds > 0 ? `${hoursDecimal(d.seconds)} h · ${money(d.amount)}` : '—'}`),
    '',
    'El PDF adjunto tiene el detalle completo.',
    '',
    `Enviado por ${sender.name} (${sender.email}) con Meditron.`,
  ].join('\n')

  return { subject, html, text }
}
