import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { overtimeRulesOf, tracksJobDetails, weekLabel, type Company } from './companies'
import type { PayPeriodSummary, PeriodEntry } from './pay-periods'
import {
  dayName, formatKeyLong, formatKeyUS, formatTime12, hoursDecimal, money, noteText,
} from './report-format'

// Hoja carta vertical
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 40
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const ROW_HEIGHT = 18
const FONT_SIZE = 9
const CELL_PADDING = 4
const FOOTER_SPACE = 36
const MIN_NOTE_WIDTH = 60

const INK = rgb(0.216, 0.208, 0.184) // #37352f
const MUTED = rgb(0.47, 0.467, 0.455) // #787774
const LINE = rgb(0.85, 0.85, 0.84)
const STRIPE = rgb(0.97, 0.97, 0.965)
const WHITE = rgb(1, 1, 1)

type Align = 'left' | 'right'

interface Column {
  header: string
  width: number
  align?: Align
  value: (entry: PeriodEntry) => string
}

const serviceLabel = (type: string | null) => {
  if (!type) return ''
  return type === 'point-to-point' ? 'P2P' : 'Hourly'
}

/** Columnas según lo que registra la compañía; la nota ocupa el espacio que sobra. */
function buildColumns(company: Company, period: PayPeriodSummary): Column[] {
  const hasOvertime = overtimeRulesOf(period.rule) !== null || period.overtimeSeconds > 0
  const columns: Column[] = [{ header: 'Fecha', width: 58, value: e => formatKeyUS(e.date.slice(0, 10)) }]
  if (!tracksJobDetails(company)) columns.push({ header: 'Día', width: 52, value: e => dayName(e.date.slice(0, 10)) })
  if (company.trackJobNumber) columns.push({ header: 'Job #', width: 54, value: e => e.jobNumber ?? '' })
  if (company.trackVehicle) columns.push({ header: 'Vehículo', width: 64, value: e => e.vehicle ?? '' })
  if (company.trackServiceType) columns.push({ header: 'Servicio', width: 46, value: e => serviceLabel(e.serviceType) })
  columns.push(
    { header: 'Entrada', width: 54, value: e => formatTime12(e.startTime) },
    { header: 'Salida', width: 54, value: e => (e.endTime ? formatTime12(e.endTime) : '') },
    { header: 'Horas', width: 42, align: 'right', value: e => hoursDecimal(e.duration ?? 0) },
  )
  if (hasOvertime) {
    columns.push(
      { header: 'Regular', width: 46, align: 'right', value: e => hoursDecimal(e.regularSeconds) },
      { header: 'Extra', width: 42, align: 'right', value: e => (e.overtimeSeconds > 0 ? hoursDecimal(e.overtimeSeconds) : '—') },
    )
  }
  columns.push({ header: 'Monto', width: 62, align: 'right', value: e => money(e.amount) })
  if (company.trackCompanyPaid) {
    columns.push({ header: 'Pagado', width: 62, align: 'right', value: e => (e.companyPaid == null ? '—' : money(e.companyPaid)) })
  }

  const used = columns.reduce((sum, c) => sum + c.width, 0)
  const remaining = CONTENT_WIDTH - used
  if (remaining >= MIN_NOTE_WIDTH) {
    columns.push({ header: 'Nota', width: remaining, value: e => noteText(e.observation) })
  } else {
    // Sin espacio para la nota: las columnas se ensanchan para llenar la hoja
    const scale = CONTENT_WIDTH / used
    for (const c of columns) c.width *= scale
  }
  return columns
}

interface Fonts {
  regular: PDFFont
  bold: PDFFont
}

// Las fuentes estándar de PDF solo cubren WinAnsi (latín): se descartan los
// caracteres que no se pueden dibujar (emojis, flechas...) y los saltos de línea.
function makeSanitizer(font: PDFFont) {
  const supported = new Set(font.getCharacterSet())
  return (text: string) =>
    [...text.replaceAll(/\s+/g, ' ')]
      .filter(ch => supported.has(ch.codePointAt(0) ?? 0))
      .join('')
      .trim()
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let cut = text
  while (cut.length > 0 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return cut ? `${cut.trimEnd()}…` : ''
}

function drawCell(page: PDFPage, text: string, x: number, width: number, baseline: number, font: PDFFont, color = INK, align: Align = 'left') {
  const fitted = fitText(text, font, FONT_SIZE, width - CELL_PADDING * 2)
  const textWidth = font.widthOfTextAtSize(fitted, FONT_SIZE)
  const textX = align === 'right' ? x + width - CELL_PADDING - textWidth : x + CELL_PADDING
  page.drawText(fitted, { x: textX, y: baseline, size: FONT_SIZE, font, color })
}

function drawHeaderRow(page: PDFPage, columns: Column[], top: number, fonts: Fonts) {
  page.drawRectangle({ x: MARGIN, y: top - ROW_HEIGHT, width: CONTENT_WIDTH, height: ROW_HEIGHT, color: INK })
  let x = MARGIN
  for (const col of columns) {
    drawCell(page, col.header, x, col.width, top - 12.5, fonts.bold, WHITE, col.align)
    x += col.width
  }
}

function summaryRows(company: Company, period: PayPeriodSummary): { label: string; value: string; strong?: boolean }[] {
  const ot = overtimeRulesOf(period.rule)
  if (ot) {
    const unit = period.rule.payType === 'daily_overtime' ? 'día' : 'semana'
    return [
      { label: 'Horas totales', value: `${hoursDecimal(period.totalSeconds)} h` },
      { label: `Horas regulares (hasta ${ot.thresholdHours} h/${unit}) × ${money(ot.baseRate)}`, value: `${hoursDecimal(period.regularSeconds)} h = ${money(period.regularPay)}` },
      { label: `Horas extra (${ot.multiplier}x) × ${money(ot.baseRate * ot.multiplier)}`, value: `${hoursDecimal(period.overtimeSeconds)} h = ${money(period.overtimePay)}` },
      { label: 'TOTAL A COBRAR', value: money(period.totalPay), strong: true },
    ]
  }
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Trabajos', value: String(period.entries.length) },
    { label: 'Horas totales', value: `${hoursDecimal(period.totalSeconds)} h` },
    { label: 'Total calculado', value: money(period.totalPay), strong: true },
  ]
  if (company.trackCompanyPaid && period.companyPaidTotal > 0) {
    const diff = period.companyPaidTotal - period.totalPay
    rows.push(
      { label: 'Pagado por la empresa', value: money(period.companyPaidTotal) },
      { label: 'Diferencia', value: `${diff >= 0 ? '+' : '-'}${money(Math.abs(diff))}` },
    )
  }
  return rows
}

export async function buildWeeklyReportPdf(
  period: PayPeriodSummary,
  company: Company,
  options: { driverName?: string | null }
): Promise<Uint8Array> {
  const columns = buildColumns(company, period)

  const pdf = await PDFDocument.create()
  pdf.setTitle(`${company.name} — ${period.start} al ${period.end}`)
  pdf.setCreator('Meditron')
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  }
  const clean = makeSanitizer(fonts.regular)

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  // ── Encabezado ──
  page.drawText(clean(company.name.toUpperCase()), { x: MARGIN, y: y - 18, size: 20, font: fonts.bold, color: INK })
  page.drawText(tracksJobDetails(company) ? 'Relación semanal de trabajos' : 'Relación semanal de horas', {
    x: MARGIN, y: y - 34, size: 11, font: fonts.regular, color: MUTED,
  })
  y -= 56

  const info: [string, string][] = [
    ['Periodo', `${formatKeyLong(period.start)} – ${formatKeyLong(period.end)}`],
    ['Semana', weekLabel(company.weekStartsOn)],
  ]
  if (options.driverName) info.unshift(['Nombre', options.driverName])
  for (const [label, value] of info) {
    page.drawText(`${label}:`, { x: MARGIN, y, size: 10, font: fonts.bold, color: INK })
    page.drawText(clean(value), { x: MARGIN + 70, y, size: 10, font: fonts.regular, color: INK })
    y -= 15
  }
  y -= 10

  // ── Tabla ──
  drawHeaderRow(page, columns, y, fonts)
  y -= ROW_HEIGHT

  if (period.entries.length === 0) {
    page.drawText('No hay trabajos registrados en esta semana.', {
      x: MARGIN + CELL_PADDING, y: y - 12.5, size: FONT_SIZE, font: fonts.regular, color: MUTED,
    })
    y -= ROW_HEIGHT
  }

  period.entries.forEach((entry, index) => {
    if (y - ROW_HEIGHT < MARGIN + FOOTER_SPACE) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
      drawHeaderRow(page, columns, y, fonts)
      y -= ROW_HEIGHT
    }
    if (index % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - ROW_HEIGHT, width: CONTENT_WIDTH, height: ROW_HEIGHT, color: STRIPE })
    }
    let x = MARGIN
    for (const col of columns) {
      drawCell(page, clean(col.value(entry)), x, col.width, y - 12.5, fonts.regular, INK, col.align)
      x += col.width
    }
    page.drawLine({ start: { x: MARGIN, y: y - ROW_HEIGHT }, end: { x: MARGIN + CONTENT_WIDTH, y: y - ROW_HEIGHT }, thickness: 0.5, color: LINE })
    y -= ROW_HEIGHT
  })

  // Fila de totales
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_WIDTH, y }, thickness: 1, color: INK })
  const hoursColumn = columns.findIndex(c => c.header === 'Horas')
  const hoursX = MARGIN + columns.slice(0, hoursColumn).reduce((s, c) => s + c.width, 0)
  drawCell(page, `Total (${period.entries.length} ${period.entries.length === 1 ? 'registro' : 'registros'})`, MARGIN, hoursX - MARGIN, y - 12.5, fonts.bold)
  drawCell(page, hoursDecimal(period.totalSeconds), hoursX, columns[hoursColumn].width, y - 12.5, fonts.bold, INK, 'right')
  y -= ROW_HEIGHT + 16

  // ── Resumen de pago ──
  const summary = summaryRows(company, period)
  const boxHeight = summary.length * 18 + 16
  if (y - boxHeight < MARGIN + FOOTER_SPACE) {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }
  const boxWidth = 330
  const boxX = MARGIN + CONTENT_WIDTH - boxWidth
  page.drawRectangle({ x: boxX, y: y - boxHeight, width: boxWidth, height: boxHeight, borderColor: INK, borderWidth: 1 })
  let lineY = y - 20
  for (const row of summary) {
    const font = row.strong ? fonts.bold : fonts.regular
    const size = row.strong ? 11 : 10
    page.drawText(clean(row.label), { x: boxX + 10, y: lineY, size, font, color: INK })
    const valueWidth = font.widthOfTextAtSize(clean(row.value), size)
    page.drawText(clean(row.value), { x: boxX + boxWidth - 10 - valueWidth, y: lineY, size, font, color: INK })
    lineY -= 18
  }

  // ── Pie de página ──
  const pages = pdf.getPages()
  const generated = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
  pages.forEach((p, i) => {
    const text = `${company.name} · ${period.start} al ${period.end} · Generado ${generated} · Página ${i + 1} de ${pages.length}`
    p.drawText(clean(text), { x: MARGIN, y: MARGIN - 10, size: 8, font: fonts.regular, color: MUTED })
  })

  return pdf.save()
}

/** "Larrys-Private" — nombre de compañía apto para nombres de archivo */
export function companyFileSlug(company: Company): string {
  const slug = company.name
    .normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/['’]/g, '')
    .replaceAll(/[^a-zA-Z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return slug || 'compania'
}

export function weeklyReportFileName(period: PayPeriodSummary, company: Company): string {
  return `${companyFileSlug(company)}_${period.start}_al_${period.end}.pdf`
}
