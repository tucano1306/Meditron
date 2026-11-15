// Compañías del modo "Por pago": quién te paga y cómo. Un monto fijo por día
// (sin importar las horas ni cuántos registros hagas ese día), un monto fijo
// por trabajo o lo que toque cada vez. Lo comparten el servidor y la app.

import type { PaymentMethod } from './payment-jobs'

export type PayCompanyType = 'per_day' | 'per_job' | 'variable'

export const PAY_COMPANY_TYPES: { value: PayCompanyType; label: string; help: string }[] = [
  { value: 'per_day', label: 'Por día', help: 'Un monto fijo por cada día que trabajas, sin importar las horas' },
  { value: 'per_job', label: 'Por trabajo', help: 'Un monto fijo por cada trabajo o viaje' },
  { value: 'variable', label: 'Variable', help: 'Cada trabajo paga distinto: lo anotas al terminar' },
]

export const MAX_PAY_COMPANIES = 30

export interface PayCompany {
  id: string
  name: string
  color: string
  payType: PayCompanyType
  /** Lo que paga por día o por trabajo; null si es variable */
  rate: number | null
  /** Cómo suele pagar, para proponerlo al guardar */
  paymentMethod: PaymentMethod | null
  /** Paga después: los trabajos quedan "por cobrar" hasta que paga */
  paysLater: boolean
  archived: boolean
  /** Lo que todavía le falta pagarte (pago + propinas) */
  pending: number
  pendingCount: number
  /** Días distintos con algo por cobrar */
  pendingDays: number
  /** Día más antiguo por cobrar (YYYY-MM-DD) */
  pendingSince: string | null
  /** Trabajos registrados con ella */
  jobCount: number
}

export function isPayCompanyType(value: unknown): value is PayCompanyType {
  return PAY_COMPANY_TYPES.some(t => t.value === value)
}

/** "$200", "$87.50", "$1,200" */
export function shortMoney(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`
}

/** "$200 por día", "$80 por trabajo", "Pago variable" */
export function describePay(company: Pick<PayCompany, 'payType' | 'rate'>): string {
  if (company.payType === 'variable' || !company.rate) return 'Pago variable'
  return `${shortMoney(company.rate)} por ${company.payType === 'per_day' ? 'día' : 'trabajo'}`
}

/** Paga un monto fijo por día: el pago se pone solo, una vez por día */
export function paysPerDay(company: Pick<PayCompany, 'payType' | 'rate'> | null | undefined): boolean {
  return company?.payType === 'per_day' && Boolean(company.rate && company.rate > 0)
}

/** Monto que se propone al anotar un trabajo con esa compañía */
export function suggestedAmount(company: Pick<PayCompany, 'payType' | 'rate'> | null | undefined): number | null {
  if (!company || company.payType === 'variable' || !company.rate) return null
  return company.rate
}

/** "1 día", "3 trabajos" */
export function countLabel(count: number, perDay: boolean): string {
  if (perDay) return `${count} ${count === 1 ? 'día' : 'días'}`
  return `${count} ${count === 1 ? 'trabajo' : 'trabajos'}`
}
