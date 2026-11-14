'use client'

import { formatCurrency } from '@/lib/utils'
import { paysPerDay, shortMoney, type PayCompany } from '@/lib/pay-companies'
import { useFetchData, type JobsResult } from './data'

// El pago de un trabajo: se escribe, o lo pone la compañía si paga por día
// (una sola vez por día aunque haya varios registros ese día).

const inputClass = 'mt-1 w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-3 py-2.5 text-[#37352f] placeholder:text-[#b4b4b0] focus:border-[#37352f] focus:outline-none'

/**
 * ¿Ese día ya tiene su pago en otro registro de la compañía? Solo pregunta si
 * la compañía paga por día. null mientras no se sabe.
 */
export function useDayCovered(company: PayCompany | null, date: string, excludeJobId?: string): boolean | null {
  const url = paysPerDay(company) && company ? `/api/payment/jobs?from=${date}&to=${date}&companyId=${company.id}` : null
  const { data } = useFetchData<JobsResult>(url)
  if (!url) return false
  if (!data) return null
  return data.jobs.some(job => job.id !== excludeJobId && job.companyId === company?.id && job.amount > 0)
}

/** Lo que se anotará de pago (sin propina) */
export function plannedAmount(company: PayCompany | null, autoPay: boolean, amount: number, covered: boolean | null): number {
  if (autoPay && paysPerDay(company)) return covered ? 0 : company?.rate ?? 0
  return amount
}

interface PayAmountFieldProps {
  readonly company: PayCompany | null
  readonly autoPay: boolean
  readonly amount: string
  readonly covered: boolean | null
  readonly onAutoChange: (autoPay: boolean) => void
  readonly onAmountChange: (amount: string) => void
  readonly large?: boolean
  readonly autoFocus?: boolean
}

export function PayAmountField({ company, autoPay, amount, covered, onAutoChange, onAmountChange, large = false, autoFocus = false }: PayAmountFieldProps) {
  const perDay = paysPerDay(company) && company
  const size = large ? '22px' : '18px'

  if (perDay && autoPay) {
    return (
      <div className="block text-[12px] font-semibold text-[#37352f]">
        Pago del día
        <div
          className="mt-1 flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 animate-fade-in"
          style={{ borderColor: `${perDay.color}66`, backgroundColor: `${perDay.color}0f` }}
        >
          <div className="min-w-0">
            <div className="font-bold leading-tight tabular-nums text-[#37352f]" style={{ fontSize: size }}>
              {covered === null ? '…' : formatCurrency(covered ? 0 : perDay.rate ?? 0)}
            </div>
            <div className="truncate text-[11px] font-normal text-[#787774]">
              {covered ? 'Ya está en otro registro del día' : `${perDay.name} paga por día`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onAutoChange(false)
              if (!amount) onAmountChange(String(perDay.rate ?? ''))
            }}
            className="flex-shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-[#2e75cc] hover:bg-white"
          >
            Cambiar
          </button>
        </div>
      </div>
    )
  }

  return (
    <label className="block text-[12px] font-semibold text-[#37352f]">
      Pago
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-[#9b9a97]">$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={e => onAmountChange(e.target.value)}
          placeholder="0.00"
          className={`${inputClass} pl-7 font-bold tabular-nums`}
          style={{ fontSize: size }}
          autoFocus={autoFocus}
          required
        />
      </div>
      {perDay && (
        <button type="button" onClick={() => onAutoChange(true)} className="mt-1 text-[11px] font-semibold text-[#2e75cc] hover:underline">
          Usar pago del día ({shortMoney(perDay.rate ?? 0)})
        </button>
      )}
    </label>
  )
}
