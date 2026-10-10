import { prisma } from './prisma'
import { updateWeekTotals, updateMonthSummary } from './week-utils'
import {
  COMPANIES,
  computeOvertime,
  dateKeyToUTC,
  detectCompany,
  getPayPeriod,
  toDateKey,
  type CompanyId,
} from './companies'

/**
 * Recalcula el monto de cada trabajo de Tecnofuel en la semana de pago (domingo
 * a sábado) que contiene `dateKey`: las primeras 40h a tarifa base y el resto a
 * hora y media. Guarda el resultado en calculatedAmount para que los totales de
 * semanas y meses (que suman ese campo) sigan siendo correctos.
 */
export async function recalculateTecnofuelPeriod(userId: string, dateKey: string) {
  const rules = COMPANIES.tecnofuel.overtime
  if (!rules) return

  const { start, end } = getPayPeriod(dateKey, 'tecnofuel')
  const candidates = await prisma.timeEntry.findMany({
    where: {
      userId,
      endTime: { not: null },
      date: { gte: dateKeyToUTC(start), lte: dateKeyToUTC(end) },
    },
    select: {
      id: true,
      startTime: true,
      duration: true,
      observation: true,
      calculatedAmount: true,
      weekId: true,
      week: { select: { year: true, month: true } },
    },
  })
  const entries = candidates.filter(e => detectCompany(e.observation) === 'tecnofuel')
  const { byEntry } = computeOvertime(entries, rules)

  const changed = entries.filter(e => {
    const amount = byEntry[e.id].amount
    return e.calculatedAmount === null || Math.abs(e.calculatedAmount - amount) > 0.0001
  })
  if (changed.length === 0) return

  await prisma.$transaction(
    changed.map(e =>
      prisma.timeEntry.update({
        where: { id: e.id },
        data: { calculatedAmount: byEntry[e.id].amount },
      })
    )
  )

  const weekIds = new Set(changed.map(e => e.weekId))
  const months = new Map(changed.map(e => [`${e.week.year}-${e.week.month}`, e.week]))
  for (const weekId of weekIds) {
    await updateWeekTotals(weekId, userId)
  }
  for (const { year, month } of months.values()) {
    await updateMonthSummary(year, month, userId)
  }
}

// ── Periodos semanales por compañía ───────────────────────────────────────────

export interface PeriodEntry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
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
  company: CompanyId
  start: string
  end: string
  /** Trabajos terminados, en orden cronológico */
  entries: PeriodEntry[]
  totalSeconds: number
  regularSeconds: number
  overtimeSeconds: number
  regularPay: number
  overtimePay: number
  totalPay: number
  companyPaidTotal: number
  hasRunningEntry: boolean
}

type DbEntry = Awaited<ReturnType<typeof prisma.timeEntry.findMany>>[number]

function emptyPeriod(company: CompanyId, start: string, end: string): PayPeriodSummary {
  return {
    company, start, end, entries: [],
    totalSeconds: 0, regularSeconds: 0, overtimeSeconds: 0,
    regularPay: 0, overtimePay: 0, totalPay: 0, companyPaidTotal: 0,
    hasRunningEntry: false,
  }
}

function summarizePeriod(
  company: CompanyId, start: string, end: string, entries: DbEntry[], userHourlyRate: number
): PayPeriodSummary {
  const summary = emptyPeriod(company, start, end)
  summary.hasRunningEntry = entries.some(e => e.endTime === null)

  const completed = entries
    .filter(e => e.endTime !== null && e.duration !== null)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

  const rules = COMPANIES[company].overtime
  const overtime = rules ? computeOvertime(completed, rules) : null

  summary.entries = completed.map(e => {
    const duration = e.duration ?? 0
    const pay = overtime?.byEntry[e.id] ?? {
      regularSeconds: duration,
      overtimeSeconds: 0,
      amount: e.calculatedAmount ?? (duration / 3600) * userHourlyRate,
    }
    return {
      id: e.id,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime?.toISOString() ?? null,
      duration: e.duration,
      date: e.date.toISOString(),
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
    }
  })

  for (const e of summary.entries) {
    summary.totalSeconds += e.duration ?? 0
    summary.regularSeconds += e.regularSeconds
    summary.overtimeSeconds += e.overtimeSeconds
    summary.totalPay += e.amount
    summary.companyPaidTotal += e.companyPaid ?? 0
  }
  if (overtime) {
    summary.regularPay = overtime.regularPay
    summary.overtimePay = overtime.overtimePay
    summary.totalPay = overtime.totalPay
  } else {
    summary.regularPay = summary.totalPay
  }
  return summary
}

/**
 * Agrupa los trabajos de una compañía en sus semanas de pago (Tecnofuel:
 * domingo a sábado con overtime; Larry's: lunes a domingo), de la más reciente
 * a la más antigua. `from`/`to` (YYYY-MM-DD) limitan los días incluidos.
 */
export async function getPayPeriods(
  userId: string,
  company: CompanyId,
  userHourlyRate: number,
  range: { from?: string; to?: string } = {}
): Promise<PayPeriodSummary[]> {
  const date: { gte?: Date; lte?: Date } = {}
  if (range.from) date.gte = dateKeyToUTC(getPayPeriod(range.from, company).start)
  if (range.to) date.lte = dateKeyToUTC(getPayPeriod(range.to, company).end)

  const all = await prisma.timeEntry.findMany({
    where: { userId, ...(range.from || range.to ? { date } : {}) },
    orderBy: { startTime: 'asc' },
  })

  const groups = new Map<string, DbEntry[]>()
  for (const entry of all) {
    if (detectCompany(entry.observation) !== company) continue
    const { start } = getPayPeriod(toDateKey(entry.date), company)
    const list = groups.get(start) ?? []
    list.push(entry)
    groups.set(start, list)
  }

  return [...groups.entries()]
    .map(([start, entries]) => summarizePeriod(company, start, getPayPeriod(start, company).end, entries, userHourlyRate))
    .sort((a, b) => b.start.localeCompare(a.start))
}

/** Semana de pago concreta (aunque no tenga trabajos). */
export async function getSinglePayPeriod(
  userId: string,
  company: CompanyId,
  userHourlyRate: number,
  dateKey: string
): Promise<PayPeriodSummary> {
  const { start, end } = getPayPeriod(dateKey, company)
  const [period] = await getPayPeriods(userId, company, userHourlyRate, { from: start, to: end })
  return period ?? emptyPeriod(company, start, end)
}
