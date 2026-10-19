import { prisma } from './prisma'
import { updateWeekTotals, updateMonthSummary } from './week-utils'
import {
  addDaysToKey,
  computeCompanyAmounts,
  dateKeyToUTC,
  getPayPeriod,
  overtimeRulesOf,
  payScopeOf,
  ruleFor,
  toDateKey,
  type AmountInput,
  type Company,
  type PayRule,
} from './companies'

type CompletedEntry = AmountInput & {
  calculatedAmount: number | null
  weekId: string
  week: { year: number; month: number }
}

async function findCompletedEntries(userId: string, companyId: string, from?: string, to?: string): Promise<CompletedEntry[]> {
  const date: { gte?: Date; lte?: Date } = {}
  if (from) date.gte = dateKeyToUTC(from)
  if (to) date.lte = dateKeyToUTC(to)
  const rows = await prisma.timeEntry.findMany({
    where: { userId, companyId, endTime: { not: null }, duration: { not: null }, ...(from || to ? { date } : {}) },
    select: {
      id: true, startTime: true, duration: true, date: true, calculatedAmount: true, weekId: true,
      week: { select: { year: true, month: true } },
    },
  })
  return rows.map(r => ({ ...r, date: toDateKey(r.date) }))
}

/** Guarda los montos nuevos y actualiza los totales de semanas y meses afectados. */
async function saveAmounts(userId: string, entries: CompletedEntry[], amounts: Record<string, number>) {
  const changed = entries.filter(e => {
    const amount = amounts[e.id]
    if (amount === undefined) return false
    return e.calculatedAmount === null || Math.abs(e.calculatedAmount - amount) > 0.0001
  })
  if (changed.length === 0) return

  await prisma.$transaction(
    changed.map(e => prisma.timeEntry.update({ where: { id: e.id }, data: { calculatedAmount: amounts[e.id] } }))
  )
  const weekIds = new Set(changed.map(e => e.weekId))
  const months = new Map(changed.map(e => [`${e.week.year}-${e.week.month}`, e.week]))
  for (const weekId of weekIds) await updateWeekTotals(weekId, userId)
  for (const { year, month } of months.values()) await updateMonthSummary(year, month, userId)
}

/**
 * Recalcula los trabajos con overtime (semanal o diario) cuyo grupo de cálculo
 * contiene alguno de esos días. Los trabajos por hora no se tocan: su monto se
 * fija al crearlos y el usuario puede ajustarlo a mano.
 */
export async function recalculateCompanyAmounts(userId: string, company: Company, dateKeys: string[]) {
  const scopes = dateKeys.map(key => payScopeOf(company, key, '')).filter(s => s.kind !== 'entry')
  if (scopes.length === 0) return

  const keys = new Set(scopes.map(s => s.key))
  const from = scopes.reduce((min, s) => (s.start < min ? s.start : min), scopes[0].start)
  const to = scopes.reduce((max, s) => (s.end > max ? s.end : max), scopes[0].end)
  const entries = (await findCompletedEntries(userId, company.id, from, to))
    .filter(e => keys.has(payScopeOf(company, e.date, e.id).key))

  const computed = computeCompanyAmounts(company, entries)
  const amounts = Object.fromEntries(Object.entries(computed).map(([id, pay]) => [id, pay.amount]))
  await saveAmounts(userId, entries, amounts)
}

/**
 * Tras cambiar el esquema de pago o la semana de una compañía, recalcula los
 * trabajos desde `fromKey`. Con overtime se recalcula todo; por hora solo los
 * montos que seguían el cálculo automático (se respetan los ajustados a mano).
 */
export async function recalculateAfterCompanyChange(userId: string, before: Company, after: Company, fromKey: string) {
  // Desde 6 días antes: la semana que contiene `fromKey` se recalcula completa
  const entries = await findCompletedEntries(userId, after.id, addDaysToKey(fromKey, -6))
  if (entries.length === 0) return

  const oldAmounts = computeCompanyAmounts(before, entries)
  const newAmounts = computeCompanyAmounts(after, entries)
  const amounts: Record<string, number> = {}
  for (const e of entries) {
    const isHourly = payScopeOf(after, e.date, e.id).kind === 'entry'
    const followedFormula = e.calculatedAmount === null || Math.abs(e.calculatedAmount - oldAmounts[e.id].amount) < 0.01
    if (!isHourly || followedFormula) amounts[e.id] = newAmounts[e.id].amount
  }
  await saveAmounts(userId, entries, amounts)
}

// ── Semanas de pago ───────────────────────────────────────────────────────────

export interface PeriodEntry {
  id: string
  startTime: string
  endTime: string | null
  /** Tiempo pagado (ya sin el break) */
  duration: number | null
  /** Break sin pago descontado, en segundos */
  breakSeconds: number
  date: string
  companyId: string | null
  jobNumber: string | null
  vehicle: string | null
  serviceType: string | null
  observation: string | null
  calculatedAmount: number | null
  paidAmount: number | null
  companyPaid: number | null
  correctionPending: boolean
  correctionNote: string | null
  correctionResolved: boolean
  correctionResolvedNote: string | null
  createdAt: string
  updatedAt: string
  /** Desglose del pago de este trabajo dentro de su semana */
  regularSeconds: number
  overtimeSeconds: number
  amount: number
}

export interface PayPeriodSummary {
  companyId: string
  start: string
  end: string
  /** Regla vigente al empezar la semana (la que se muestra en el reporte) */
  rule: PayRule
  /** Trabajos terminados, en orden cronológico */
  entries: PeriodEntry[]
  totalSeconds: number
  regularSeconds: number
  overtimeSeconds: number
  regularPay: number
  overtimePay: number
  totalPay: number
  companyPaidTotal: number
  /** Break sin pago descontado en la semana, en segundos */
  breakSeconds: number
  hasRunningEntry: boolean
}

type DbEntry = Awaited<ReturnType<typeof prisma.timeEntry.findMany>>[number]

function emptyPeriod(company: Company, start: string, end: string): PayPeriodSummary {
  return {
    companyId: company.id, start, end, rule: ruleFor(company, start), entries: [],
    totalSeconds: 0, regularSeconds: 0, overtimeSeconds: 0,
    regularPay: 0, overtimePay: 0, totalPay: 0, companyPaidTotal: 0, breakSeconds: 0,
    hasRunningEntry: false,
  }
}

function summarizePeriod(company: Company, start: string, end: string, entries: DbEntry[]): PayPeriodSummary {
  const summary = emptyPeriod(company, start, end)
  summary.hasRunningEntry = entries.some(e => e.endTime === null)

  const completed = entries
    .filter(e => e.endTime !== null && e.duration !== null)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  const computed = computeCompanyAmounts(company, completed.map(e => ({ ...e, date: toDateKey(e.date) })))

  for (const e of completed) {
    const dateKey = toDateKey(e.date)
    const scope = payScopeOf(company, dateKey, e.id)
    const duration = e.duration ?? 0
    const ot = overtimeRulesOf(scope.rule)
    // Por hora se respeta el monto guardado (puede estar ajustado a mano)
    const pay = ot
      ? computed[e.id]
      : { regularSeconds: duration, overtimeSeconds: 0, amount: e.calculatedAmount ?? computed[e.id].amount }
    const regularPay = ot ? (pay.regularSeconds / 3600) * ot.baseRate : pay.amount

    summary.entries.push({
      id: e.id,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime?.toISOString() ?? null,
      duration: e.duration,
      breakSeconds: e.breakSeconds ?? 0,
      date: e.date.toISOString(),
      companyId: e.companyId,
      jobNumber: e.jobNumber,
      vehicle: e.vehicle,
      serviceType: e.serviceType,
      observation: e.observation,
      calculatedAmount: pay.amount,
      paidAmount: e.paidAmount,
      companyPaid: e.companyPaid,
      correctionPending: e.correctionPending,
      correctionNote: e.correctionNote,
      correctionResolved: e.correctionResolved,
      correctionResolvedNote: e.correctionResolvedNote,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      ...pay,
    })
    summary.totalSeconds += duration
    summary.regularSeconds += pay.regularSeconds
    summary.overtimeSeconds += pay.overtimeSeconds
    summary.regularPay += regularPay
    summary.overtimePay += pay.amount - regularPay
    summary.totalPay += pay.amount
    summary.companyPaidTotal += e.companyPaid ?? 0
    summary.breakSeconds += e.breakSeconds ?? 0
  }
  return summary
}

/**
 * Agrupa los trabajos de una compañía en sus semanas de pago, de la más
 * reciente a la más antigua. `from`/`to` (YYYY-MM-DD) limitan las semanas.
 */
export async function getPayPeriods(
  userId: string,
  company: Company,
  range: { from?: string; to?: string } = {}
): Promise<PayPeriodSummary[]> {
  const date: { gte?: Date; lte?: Date } = {}
  if (range.from) date.gte = dateKeyToUTC(getPayPeriod(range.from, company.weekStartsOn).start)
  if (range.to) date.lte = dateKeyToUTC(getPayPeriod(range.to, company.weekStartsOn).end)

  const all = await prisma.timeEntry.findMany({
    where: { userId, companyId: company.id, ...(range.from || range.to ? { date } : {}) },
    orderBy: { startTime: 'asc' },
  })

  const groups = new Map<string, DbEntry[]>()
  for (const entry of all) {
    const { start } = getPayPeriod(toDateKey(entry.date), company.weekStartsOn)
    const list = groups.get(start) ?? []
    list.push(entry)
    groups.set(start, list)
  }

  return [...groups.entries()]
    .map(([start, entries]) => summarizePeriod(company, start, getPayPeriod(start, company.weekStartsOn).end, entries))
    .sort((a, b) => b.start.localeCompare(a.start))
}

/** Semana de pago concreta (aunque no tenga trabajos). */
export async function getSinglePayPeriod(userId: string, company: Company, dateKey: string): Promise<PayPeriodSummary> {
  const { start, end } = getPayPeriod(dateKey, company.weekStartsOn)
  const [period] = await getPayPeriods(userId, company, { from: start, to: end })
  return period ?? emptyPeriod(company, start, end)
}
