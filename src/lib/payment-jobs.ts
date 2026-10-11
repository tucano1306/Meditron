// Trabajos del modo "Por pago": cada trabajo tiene tiempo, pago, propina, cómo
// se cobró y si ya se cobró. Lo comparten el servidor y la app.

export type PaymentMethod = 'cash' | 'zelle' | 'card' | 'check' | 'transfer' | 'app' | 'other'
export type PaymentStatus = 'paid' | 'pending'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'check', label: 'Cheque' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'app', label: 'App' },
  { value: 'other', label: 'Otro' },
]

export const VEHICLES: { value: string; label: string }[] = [
  { value: 'sprinter', label: 'Sprinter' },
  { value: 'mini-bus', label: 'Mini Bus' },
  { value: 'motorcoach', label: 'Motorcoach' },
]

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHODS.some(m => m.value === value)
}

export function methodLabel(value: string | null | undefined): string | null {
  return PAYMENT_METHODS.find(m => m.value === value)?.label ?? null
}

export function vehicleLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return VEHICLES.find(v => v.value === value)?.label ?? value
}

/** Trabajo terminado, como lo devuelve la API */
export interface PaymentJob {
  id: string
  /** YYYY-MM-DD (día en Florida) */
  date: string
  startTime: string
  endTime: string
  /** Segundos */
  duration: number
  amount: number
  tip: number
  client: string | null
  jobNumber: string | null
  vehicle: string | null
  notes: string | null
  paymentMethod: PaymentMethod | null
  paymentStatus: PaymentStatus
  paidAt: string | null
}

/** Pago + propina */
export function jobEarned(job: Pick<PaymentJob, 'amount' | 'tip'>): number {
  return job.amount + job.tip
}

/** Lo ganado por hora (pago + propina) */
export function ratePerHour(earned: number, seconds: number): number {
  return seconds > 0 ? earned / (seconds / 3600) : 0
}

/** Nombre del trabajo para mostrar: cliente, número o "Trabajo" */
export function jobTitle(job: Pick<PaymentJob, 'client' | 'jobNumber'>): string {
  return job.client || (job.jobNumber ? `Trabajo #${job.jobNumber}` : 'Trabajo')
}

export interface JobTotals {
  count: number
  seconds: number
  amount: number
  tips: number
  earned: number
  rate: number
  pending: number
  pendingCount: number
}

export function summarizeJobs(jobs: PaymentJob[]): JobTotals {
  const totals = jobs.reduce(
    (acc, job) => {
      acc.count += 1
      acc.seconds += job.duration
      acc.amount += job.amount
      acc.tips += job.tip
      if (job.paymentStatus === 'pending') {
        acc.pending += jobEarned(job)
        acc.pendingCount += 1
      }
      return acc
    },
    { count: 0, seconds: 0, amount: 0, tips: 0, earned: 0, rate: 0, pending: 0, pendingCount: 0 }
  )
  totals.earned = totals.amount + totals.tips
  totals.rate = ratePerHour(totals.earned, totals.seconds)
  return totals
}
