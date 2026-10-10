// Compañías para las que se registran horas.
//
// La compañía de cada trabajo sale de su nota (observation): si la nota menciona
// "Tecnofuel" el trabajo es de Tecnofuel; cualquier otro trabajo es de Larry's
// Private, que mantiene la lógica de siempre (tarifa por hora del usuario).
//
// Este módulo no usa Prisma: lo comparten el backend y el frontend.

export type CompanyId = 'larrys' | 'tecnofuel'

export interface OvertimeRules {
  /** $/hora de las primeras horas de la semana */
  baseRate: number
  /** Horas semanales a tarifa normal antes del overtime */
  thresholdHours: number
  /** Multiplicador del overtime (1.5 = hora y media) */
  multiplier: number
}

export interface CompanyConfig {
  id: CompanyId
  name: string
  shortName: string
  /** Día en que empieza la semana de pago: 0 = domingo, 1 = lunes */
  weekStartsOn: 0 | 1
  /** Texto para mostrar el periodo semanal */
  weekLabel: string
  /** null = cada trabajo se paga con la tarifa por hora del usuario (Larry's) */
  overtime: OvertimeRules | null
  /** Se registran nº de trabajo, vehículo y tipo de servicio */
  tracksJobDetails: boolean
}

export const COMPANIES: Record<CompanyId, CompanyConfig> = {
  larrys: {
    id: 'larrys',
    name: "Larry's Private",
    shortName: "Larry's",
    weekStartsOn: 1,
    weekLabel: 'Lunes a Domingo',
    overtime: null,
    tracksJobDetails: true,
  },
  tecnofuel: {
    id: 'tecnofuel',
    name: 'Tecnofuel',
    shortName: 'Tecnofuel',
    weekStartsOn: 0,
    weekLabel: 'Domingo a Sábado',
    overtime: { baseRate: 28, thresholdHours: 40, multiplier: 1.5 },
    tracksJobDetails: false,
  },
}

export const COMPANY_IDS: CompanyId[] = ['larrys', 'tecnofuel']

export function isCompanyId(value: unknown): value is CompanyId {
  return value === 'larrys' || value === 'tecnofuel'
}

// ── Detección por nota ────────────────────────────────────────────────────────

// Acepta "Tecnofuel", "Technofuel", "Tecno fuel", "TECNO-FUEL"...
const TECNOFUEL_PATTERN = /te(?:c|ch)no[\s-]*fuel/i
const TECNOFUEL_TAGS = /te(?:c|ch)no[\s-]*fuel[\s:.,-]*/gi
const LEADING_LARRYS_TAG = /^larr(?:y|ie)'?s?\b(?:[\s-]*private)?[\s:.,-]*/i

export function detectCompany(note: string | null | undefined): CompanyId {
  return note && TECNOFUEL_PATTERN.test(note) ? 'tecnofuel' : 'larrys'
}

/**
 * Devuelve la nota con la etiqueta de la compañía indicada, conservando el resto
 * del texto. Tecnofuel lleva "Tecnofuel" al principio; Larry's no necesita
 * etiqueta, así que solo se quita cualquier mención a Tecnofuel.
 */
export function withCompanyTag(note: string | null | undefined, company: CompanyId): string | null {
  const text = (note ?? '').trim()
  if (company === 'tecnofuel') {
    if (TECNOFUEL_PATTERN.test(text)) return text
    const rest = text.replace(LEADING_LARRYS_TAG, '').trim()
    return rest ? `Tecnofuel ${rest}` : 'Tecnofuel'
  }
  const rest = text.replace(TECNOFUEL_TAGS, ' ').replace(/\s{2,}/g, ' ').trim()
  return rest || null
}

// ── Fechas como claves YYYY-MM-DD (días de Florida guardados como UTC midnight) ──

export function toDateKey(date: Date | string): string {
  return (typeof date === 'string' ? date : date.toISOString()).slice(0, 10)
}

export function dateKeyToUTC(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Semana de pago (inicio y fin inclusive) de la compañía que contiene ese día. */
export function getPayPeriod(dateKey: string, company: CompanyId): { start: string; end: string } {
  const dayOfWeek = dateKeyToUTC(dateKey).getUTCDay()
  const offset = (dayOfWeek - COMPANIES[company].weekStartsOn + 7) % 7
  const start = addDaysToKey(dateKey, -offset)
  return { start, end: addDaysToKey(start, 6) }
}

// ── Overtime semanal ──────────────────────────────────────────────────────────

export interface OvertimeInput {
  id: string
  startTime: string | Date
  duration: number | null
}

export interface EntryPay {
  regularSeconds: number
  overtimeSeconds: number
  amount: number
}

export interface OvertimeResult {
  totalSeconds: number
  regularSeconds: number
  overtimeSeconds: number
  regularPay: number
  overtimePay: number
  totalPay: number
  baseRate: number
  overtimeRate: number
  thresholdHours: number
  byEntry: Record<string, EntryPay>
}

/**
 * Reparte las horas de una semana entre tarifa normal y overtime en orden
 * cronológico: las primeras `thresholdHours` horas van a tarifa base y todo lo
 * que pase de ahí a tarifa × multiplicador. Un trabajo que cruza el límite se
 * paga en parte normal y en parte overtime.
 */
export function computeOvertime(entries: OvertimeInput[], rules: OvertimeRules): OvertimeResult {
  const thresholdSeconds = rules.thresholdHours * 3600
  const overtimeRate = rules.baseRate * rules.multiplier
  const sorted = [...entries].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  const byEntry: Record<string, EntryPay> = {}
  let accumulated = 0
  for (const entry of sorted) {
    const duration = Math.max(0, entry.duration ?? 0)
    const regular = Math.min(duration, Math.max(0, thresholdSeconds - accumulated))
    const overtime = duration - regular
    accumulated += duration
    byEntry[entry.id] = {
      regularSeconds: regular,
      overtimeSeconds: overtime,
      amount: (regular / 3600) * rules.baseRate + (overtime / 3600) * overtimeRate,
    }
  }

  const regularSeconds = Math.min(accumulated, thresholdSeconds)
  const overtimeSeconds = accumulated - regularSeconds
  const regularPay = (regularSeconds / 3600) * rules.baseRate
  const overtimePay = (overtimeSeconds / 3600) * overtimeRate

  return {
    totalSeconds: accumulated,
    regularSeconds,
    overtimeSeconds,
    regularPay,
    overtimePay,
    totalPay: regularPay + overtimePay,
    baseRate: rules.baseRate,
    overtimeRate,
    thresholdHours: rules.thresholdHours,
    byEntry,
  }
}

/** Monto de `seconds` trabajados cuando ya se llevan `priorSeconds` en la semana. */
export function overtimeAmount(priorSeconds: number, seconds: number, rules: OvertimeRules): number {
  const thresholdSeconds = rules.thresholdHours * 3600
  const regular = Math.min(seconds, Math.max(0, thresholdSeconds - priorSeconds))
  const overtime = seconds - regular
  return (regular / 3600) * rules.baseRate + (overtime / 3600) * rules.baseRate * rules.multiplier
}
