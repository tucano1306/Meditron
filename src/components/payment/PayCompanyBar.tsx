'use client'

import { Building2, Plus, Settings2 } from 'lucide-react'
import { describePay, type PayCompany } from '@/lib/pay-companies'
import { PAY_ACCENT } from './shared'

// Para quién es el trabajo: las compañías del modo por pago en fichas que se
// tocan. La elegida decide cuánto se anota al terminar (por día o por trabajo).

interface PayCompanyBarProps {
  /** null mientras cargan */
  readonly companies: PayCompany[] | null
  readonly value: string | null
  readonly onChange: (companyId: string | null) => void
  readonly onManage: () => void
  readonly onAdd: () => void
  /** Hay un trabajo en curso: la ficha cambia la compañía de ese trabajo */
  readonly running?: boolean
  readonly disabled?: boolean
}

export function PayCompanyBar({ companies, value, onChange, onManage, onAdd, running = false, disabled = false }: PayCompanyBarProps) {
  if (companies === null) {
    return <div className="h-[58px] animate-pulse rounded-xl bg-[rgba(55,53,47,0.04)]" />
  }

  const visible = companies.filter(c => !c.archived || c.id === value)
  if (visible.length === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-[rgba(55,53,47,0.2)] px-3 py-2.5 text-left transition-colors hover:border-[rgba(46,117,204,0.5)] hover:bg-[rgba(46,117,204,0.04)] touch-manipulation"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(46,117,204,0.1)]" style={{ color: PAY_ACCENT }}>
          <Building2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[#37352f]">Agregar compañía</span>
          <span className="block truncate text-[11px] text-[#787774]">¿Te pagan por día o por trabajo? El pago se anota solo</span>
        </span>
        <Plus className="h-4 w-4 flex-shrink-0 text-[#9b9a97] transition-colors group-hover:text-[#2e75cc]" />
      </button>
    )
  }

  const chip = (active: boolean) =>
    `flex min-w-[118px] max-w-[190px] flex-shrink-0 snap-start flex-col items-start rounded-xl border px-3 py-2 text-left transition-all touch-manipulation active:scale-[0.98] disabled:opacity-60 ${
      active ? 'border-transparent bg-[#37352f] text-white shadow-sm' : 'border-[rgba(55,53,47,0.14)] bg-white text-[#37352f] hover:bg-[rgba(55,53,47,0.04)]'
    }`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#787774]">
          {running ? 'Trabajando para' : '¿Para quién trabajas?'}
        </span>
        <button
          type="button"
          onClick={onManage}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#37352f] transition-colors hover:bg-[rgba(55,53,47,0.08)] touch-manipulation"
        >
          <Settings2 className="h-3.5 w-3.5" /> Compañías
        </button>
      </div>
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Compañía del trabajo">
        {visible.map(company => {
          const active = value === company.id
          return (
            <button
              key={company.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(active ? null : company.id)}
              className={chip(active)}
            >
              <span className="flex w-full items-center gap-1.5">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-2 ring-white/60" style={{ backgroundColor: company.color }} />
                <span className="truncate text-[13px] font-semibold">{company.name}</span>
              </span>
              <span className={`mt-0.5 truncate text-[11px] tabular-nums ${active ? 'text-white/70' : 'text-[#787774]'}`}>{describePay(company)}</span>
            </button>
          )
        })}
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          disabled={disabled}
          onClick={() => onChange(null)}
          className={chip(value === null)}
        >
          <span className="text-[13px] font-semibold">Sin compañía</span>
          <span className={`mt-0.5 text-[11px] ${value === null ? 'text-white/70' : 'text-[#787774]'}`}>Escribes el pago</span>
        </button>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Agregar compañía"
          className="flex w-12 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-[rgba(55,53,47,0.2)] text-[#9b9a97] transition-colors hover:border-[#2e75cc] hover:text-[#2e75cc] touch-manipulation"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
