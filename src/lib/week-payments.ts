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
}

interface PeriodLike {
  end: string
  totalPay: number
  totalSeconds: number
  payment: WeekPayment | null
}

export function weekPayStatus(period: PeriodLike, today: string): WeekPayStatus {
  const expected = Math.round(period.totalPay * 100) / 100
  const payment = period.payment
  if (!payment) {
    let state: WeekPayState = 'owed'
    if (expected <= 0) state = 'empty'
    else if (period.end >= today) state = 'in_progress'
    return { state, expected, paid: 0, difference: 0, owed: state === 'owed' ? expected : 0, hoursDifference: null }
  }
  const difference = Math.round((payment.amount - expected) * 100) / 100
  let state: WeekPayState = 'paid'
  if (difference < -PAY_TOLERANCE) state = 'short'
  else if (difference > PAY_TOLERANCE) state = 'over'
  return {
    state,
    expected,
    paid: payment.amount,
    difference,
    owed: state === 'short' ? -difference : 0,
    hoursDifference: payment.hours === null ? null : Math.round((payment.hours - period.totalSeconds / 3600) * 100) / 100,
  }
}

export interface PaySummary {
  /** Semanas terminadas sin pago registrado */
  owedWeeks: number
  /** Semanas pagadas de menos */
  shortWeeks: number
  /** Total que falta cobrar (sin pago + pagado de menos) */
  owedTotal: number
  /** Total pagado de más */
  overTotal: number
  paidWeeks: number
}

export function summarizePayStatus(periods: PeriodLike[], today: string): PaySummary {
  const summary: PaySummary = { owedWeeks: 0, shortWeeks: 0, owedTotal: 0, overTotal: 0, paidWeeks: 0 }
  for (const period of periods) {
    const status = weekPayStatus(period, today)
    if (status.state === 'owed') summary.owedWeeks += 1
    if (status.state === 'short') summary.shortWeeks += 1
    if (status.state === 'over') summary.overTotal += status.difference
    if (status.state === 'paid' || status.state === 'short' || status.state === 'over') summary.paidWeeks += 1
    summary.owedTotal += status.owed
  }
  summary.owedTotal = Math.round(summary.owedTotal * 100) / 100
  summary.overTotal = Math.round(summary.overTotal * 100) / 100
  return summary
}
