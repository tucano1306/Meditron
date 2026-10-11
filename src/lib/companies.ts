// Compañías y esquemas de pago.
//
// Cada usuario configura sus compañías (empleadores): qué datos registra por
// trabajo, en qué día empieza su semana de pago y cómo se le paga. El esquema de
// pago se guarda por versiones con fecha de vigencia (PayRule), así un cambio de
// tarifa no altera las semanas ya cobradas.
//
// Este módulo no usa Prisma: lo comparten el backend y el frontend.

export type PayType = 'hourly' | 'weekly_overtime' | 'daily_overtime'

export const PAY_TYPES: { value: PayType; label: string; help: string }[] = [
  { value: 'hourly', label: 'Por hora', help: 'Cada trabajo se paga horas × tarifa' },
  { value: 'weekly_overtime', label: 'Por hora + overtime semanal', help: 'Después de X horas en la semana se paga con multiplicador' },
  { value: 'daily_overtime', label: 'Por hora + overtime diario', help: 'Después de X horas en el día se paga con multiplicador' },
]

export function isPayType(value: unknown): value is PayType {
  return value === 'hourly' || value === 'weekly_overtime' || value === 'daily_overtime'
}

export interface PayRule {
  id?: string
  /** YYYY-MM-DD: la regla aplica desde este día (hasta la siguiente versión) */
  effectiveFrom: string
  payType: PayType
  hourlyRate: number
  overtimeAfterHours: number | null
  overtimeMultiplier: number | null
}

export interface Company {
  id: string
  name: string
  color: string
  /** 0 = domingo ... 6 = sábado */
  weekStartsOn: number
  trackJobNumber: boolean
  trackVehicle: boolean
  trackServiceType: boolean
  trackCompanyPaid: boolean
  archived: boolean
  sortOrder: number
  /** Correos que reciben el reporte semanal */
  reportEmails: string[]
  /** Versiones del esquema de pago, de la más antigua a la más reciente */
  payRules: PayRule[]
}

/** Fecha desde la que aplica la primera regla de una compañía (todo el historial) */
export const FIRST_RULE_DATE = '2000-01-01'

export const COMPANY_COLORS = ['#37352f', '#d9730d', '#0f7b6c', '#2e75cc', '#9065b0', '#e03e3e', '#dfab01']

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function weekLabel(weekStartsOn: number): string {
  return `${DAY_NAMES[weekStartsOn]} a ${DAY_NAMES[(weekStartsOn + 6) % 7]}`
}

export function weekShortLabel(weekStartsOn: number): string {
  return `${DAY_SHORT[weekStartsOn]}–${DAY_SHORT[(weekStartsOn + 6) % 7]}`
}

export function tracksJobDetails(company: Company): boolean {
  return company.trackJobNumber || company.trackVehicle || company.trackServiceType
}

/** Compañía a la que van los trabajos sin compañía asignada: la primera activa */
export function defaultCompany(companies: Company[]): Company | null {
  return companies.find(c => !c.archived) ?? companies[0] ?? null
}

export function companyOfEntry(companyId: string | null | undefined, companies: Company[]): Company | null {
  return companies.find(c => c.id === companyId) ?? defaultCompany(companies)
}

// ── Reglas de pago ────────────────────────────────────────────────────────────

/** Regla vigente en ese día (YYYY-MM-DD) */
export function ruleFor(company: Company, dateKey: string): PayRule {
  const rules = company.payRules
  let current = rules[0]
  for (const rule of rules) {
    if (rule.effectiveFrom <= dateKey) current = rule
  }
  return current
}

export interface OvertimeRules {
  /** $/hora de las horas normales */
  baseRate: number
  /** Horas a tarifa normal antes del overtime (por semana o por día) */
  thresholdHours: number
  /** Multiplicador del overtime (1.5 = hora y media) */
  multiplier: number
}

export function overtimeRulesOf(rule: PayRule): OvertimeRules | null {
  if (rule.payType === 'hourly') return null
  return {
    baseRate: rule.hourlyRate,
    thresholdHours: rule.overtimeAfterHours ?? (rule.payType === 'daily_overtime' ? 8 : 40),
    multiplier: rule.overtimeMultiplier ?? 1.5,
  }
}

function formatRate(n: number): string {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`
}

/** "$28/h · después de 40 h/semana a 1.5x" */
export function describeRule(rule: PayRule): string {
  const ot = overtimeRulesOf(rule)
  if (!ot) return `${formatRate(rule.hourlyRate)}/h`
  const unit = rule.payType === 'daily_overtime' ? 'día' : 'semana'
  return `${formatRate(ot.baseRate)}/h · después de ${ot.thresholdHours} h/${unit} a ${ot.multiplier}x`
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

/** Semana de pago (inicio y fin inclusive) que contiene ese día. */
export function getPayPeriod(dateKey: string, weekStartsOn: number): { start: string; end: string } {
  const dayOfWeek = dateKeyToUTC(dateKey).getUTCDay()
  const offset = (dayOfWeek - weekStartsOn + 7) % 7
  const start = addDaysToKey(dateKey, -offset)
  return { start, end: addDaysToKey(start, 6) }
}

// ── Overtime ──────────────────────────────────────────────────────────────────

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
 * Reparte las horas de un periodo (semana o día) entre tarifa normal y overtime
 * en orden cronológico: las primeras `thresholdHours` horas van a tarifa base y
 * lo que pase de ahí a tarifa × multiplicador. Un trabajo que cruza el límite se
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

/** Monto de `seconds` trabajados cuando ya se llevan `priorSeconds` en el periodo. */
export function overtimeAmount(priorSeconds: number, seconds: number, rules: OvertimeRules): number {
  const thresholdSeconds = rules.thresholdHours * 3600
  const regular = Math.min(seconds, Math.max(0, thresholdSeconds - priorSeconds))
  const overtime = seconds - regular
  return (regular / 3600) * rules.baseRate + (overtime / 3600) * rules.baseRate * rules.multiplier
}

// ── Monto de cada trabajo según la regla vigente ──────────────────────────────

export interface AmountInput extends OvertimeInput {
  /** Día del trabajo (YYYY-MM-DD) */
  date: string
}

export interface PayScope {
  /** Clave del grupo que comparte el cálculo de overtime */
  key: string
  rule: PayRule
  kind: 'week' | 'day' | 'entry'
  /** Primer y último día del grupo */
  start: string
  end: string
}

/**
 * Grupo de cálculo de un trabajo: con overtime semanal, todos los trabajos de su
 * semana de pago; con overtime diario, los de su día; por hora, el trabajo solo.
 * La regla de una semana es la vigente el día que empieza la semana.
 */
export function payScopeOf(company: Company, dateKey: string, entryId: string): PayScope {
  const week = getPayPeriod(dateKey, company.weekStartsOn)
  const weekRule = ruleFor(company, week.start)
  if (weekRule.payType === 'weekly_overtime') {
    return { key: `w:${week.start}`, rule: weekRule, kind: 'week', start: week.start, end: week.end }
  }
  const dayRule = ruleFor(company, dateKey)
  if (dayRule.payType === 'daily_overtime') {
    return { key: `d:${dateKey}`, rule: dayRule, kind: 'day', start: dateKey, end: dateKey }
  }
  return { key: `e:${entryId}`, rule: dayRule, kind: 'entry', start: dateKey, end: dateKey }
}

/**
 * Monto de cada trabajo terminado según la regla vigente (con overtime cuando
 * corresponde). Para trabajos por hora devuelve horas × tarifa.
 */
export function computeCompanyAmounts(company: Company, entries: AmountInput[]): Record<string, EntryPay> {
  const groups = new Map<string, { scope: PayScope; entries: AmountInput[] }>()
  for (const entry of entries) {
    const scope = payScopeOf(company, entry.date, entry.id)
    const group = groups.get(scope.key) ?? { scope, entries: [] }
    group.entries.push(entry)
    groups.set(scope.key, group)
  }

  const result: Record<string, EntryPay> = {}
  for (const { scope, entries: list } of groups.values()) {
    const ot = overtimeRulesOf(scope.rule)
    if (ot) {
      Object.assign(result, computeOvertime(list, ot).byEntry)
    } else {
      for (const e of list) {
        const duration = Math.max(0, e.duration ?? 0)
        result[e.id] = { regularSeconds: duration, overtimeSeconds: 0, amount: (duration / 3600) * scope.rule.hourlyRate }
      }
    }
  }
  return result
}
