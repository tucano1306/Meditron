// Pago de cada semana de pago: lo que la empresa pagó (según el talonario)
// comparado con lo que calcula la app. Sin Prisma: lo comparten el backend y
// el frontend.

export interface WeekPayment {
  id: string
  /** Primer día de la semana de pago (YYYY-MM-DD) */
  weekStart: string
  /** Bruto que pagó la empresa por la semana */
  amount: number
  /** Lo que llegó al banco, después de impuestos */
  netAmount: number | null
  /** Horas que pagó la empresa según el talonario */
  hours: number | null
  /** Día en que se recibió el pago (YYYY-MM-DD) */
  paidOn: string
  reference: string | null
  note: string | null
}

/** Diferencia que se considera redondeo del talonario, no un error */
export const PAY_TOLERANCE = 0.5

/**
 * - `in_progress`: la semana todavía no termina y no hay pago
 * - `owed`: terminó y no se ha registrado el pago
 * - `paid`: pagada y coincide con la app
 * - `short`: pagaron menos de lo que calcula la app
 * - `over`: pagaron más
 * - `empty`: sin horas ni pago
 */
export type WeekPayState = 'in_progress' | 'owed' | 'paid' | 'short' | 'over' | 'empty'

export interface WeekPayStatus {
  state: WeekPayState
  /** Lo que calcula la app para la semana */
  expected: number
  /** Pagado por la empresa (0 si aún no) */
  paid: number
  /** Pagado − calculado (solo con pago) */
  difference: number
  /** Lo que todavía falta cobrar (0 si nada) */
  owed: number
  /** Horas del talonario − horas de la app (si se anotaron) */
  hoursDifference: number | null
  /** Trabajos que la empresa todavía no paga (solo cuando el pago se anota por trabajo) */
  unpaidJobs: number
}

/** Un trabajo de la semana: lo que calcula la app y lo que anotaste que pagó la empresa */
export interface JobPayLike {
  amount: number
  companyPaid: number | null
}

interface PeriodLike {
  end: string
  totalPay: number
  totalSeconds: number
  payment: WeekPayment | null
  /** Trabajos terminados; se usan cuando el pago se anota en cada trabajo */
  entries?: readonly JobPayLike[]
}

export interface PayStatusOptions {
  /**
   * La empresa paga por trabajo: lo pagado se anota en cada uno (como Larry's)
   * en vez de registrar un pago por semana. Un pago semanal, si lo hay, manda.
   */
  byJob?: boolean
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** Un trabajo cuenta como pagado cuando tiene anotado lo que pagó la empresa */
export function isJobPaid(job: JobPayLike): boolean {
  return job.companyPaid !== null && job.companyPaid > 0
}

function unpaidStatus(expected: number, end: string, today: string, unpaidJobs: number): WeekPayStatus {
  let state: WeekPayState = 'owed'
  if (expected <= 0) state = 'empty'
  else if (end >= today) state = 'in_progress'
  return {
    state,
    expected,
    paid: 0,
    difference: 0,
    owed: state === 'owed' ? expected : 0,
    hoursDifference: null,
    unpaidJobs: state === 'owed' ? unpaidJobs : 0,
  }
}

/**
 * Semana de una empresa que paga por trabajo: lo que falta son los trabajos
 * sin pago anotado más lo que pagaron de menos en los que sí tienen pago.
 */
function jobsPayStatus(period: PeriodLike, today: string): WeekPayStatus {
  const expected = round2(period.totalPay)
  const jobs = (period.entries ?? []).filter(job => job.amount > 0 || isJobPaid(job))
  const paidJobs = jobs.filter(isJobPaid)
  const unpaid = jobs.filter(job => !isJobPaid(job))
  if (paidJobs.length === 0) return unpaidStatus(expected, period.end, today, unpaid.length)

  const paid = round2(paidJobs.reduce((sum, job) => sum + (job.companyPaid ?? 0), 0))
  // Solo se compara contra los trabajos que ya tienen pago
  const difference = round2(paid - paidJobs.reduce((sum, job) => sum + job.amount, 0))
  const shortfall = difference < -PAY_TOLERANCE ? -difference : 0
  const base = { expected, paid, difference, hoursDifference: null }

  if (unpaid.length > 0) {
    // Semana en curso: los que faltan todavía pueden llegar
    if (period.end >= today) return { ...base, state: 'in_progress', owed: 0, unpaidJobs: 0 }
    const unpaidAmount = unpaid.reduce((sum, job) => sum + job.amount, 0)
    return { ...base, state: 'owed', owed: round2(unpaidAmount + shortfall), unpaidJobs: unpaid.length }
  }

  let state: WeekPayState = 'paid'
  if (difference < -PAY_TOLERANCE) state = 'short'
  else if (difference > PAY_TOLERANCE) state = 'over'
  return { ...base, state, owed: shortfall, unpaidJobs: 0 }
}

export function weekPayStatus(period: PeriodLike, today: string, options: PayStatusOptions = {}): WeekPayStatus {
  const payment = period.payment
  if (!payment && options.byJob) return jobsPayStatus(period, today)

  const expected = round2(period.totalPay)
  if (!payment) return unpaidStatus(expected, period.end, today, 0)
  const difference = round2(payment.amount - expected)
  let state: WeekPayState = 'paid'
  if (difference < -PAY_TOLERANCE) state = 'short'
  else if (difference > PAY_TOLERANCE) state = 'over'
  return {
    state,
    expected,
    paid: payment.amount,
    difference,
    owed: state === 'short' ? -difference : 0,
    hoursDifference: payment.hours === null ? null : round2(payment.hours - period.totalSeconds / 3600),
    unpaidJobs: 0,
  }
}

export interface PaySummary {
  /** Semanas terminadas sin pago registrado (o con trabajos sin pagar) */
  owedWeeks: number
  /** Semanas pagadas de menos */
  shortWeeks: number
  /** Total que falta cobrar (sin pago + pagado de menos) */
  owedTotal: number
  /** Total pagado de más */
  overTotal: number
  paidWeeks: number
  /** Trabajos sin pago anotado (solo cuando se paga por trabajo) */
  owedJobs: number
  /** El pago se anota en cada trabajo, no por semana */
  byJob: boolean
  /** Inicio de la semana más antigua que falta cobrar (YYYY-MM-DD) */
  oldestOwed: string | null
}

export function summarizePayStatus(periods: (PeriodLike & { start: string })[], today: string, options: PayStatusOptions = {}): PaySummary {
  const summary: PaySummary = {
    owedWeeks: 0, shortWeeks: 0, owedTotal: 0, overTotal: 0, paidWeeks: 0,
    owedJobs: 0, byJob: Boolean(options.byJob), oldestOwed: null,
  }
  for (const period of periods) {
    const status = weekPayStatus(period, today, options)
    if (status.state === 'owed') summary.owedWeeks += 1
    if (status.state === 'short') summary.shortWeeks += 1
    if (status.state === 'over') summary.overTotal += status.difference
    if (status.state === 'paid' || status.state === 'short' || status.state === 'over') summary.paidWeeks += 1
    if (status.owed > 0 && (!summary.oldestOwed || period.start < summary.oldestOwed)) summary.oldestOwed = period.start
    summary.owedTotal += status.owed
    summary.owedJobs += status.unpaidJobs
  }
  summary.owedTotal = round2(summary.owedTotal)
  summary.overTotal = round2(summary.overTotal)
  return summary
}
