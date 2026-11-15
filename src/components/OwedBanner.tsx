'use client'

import { Banknote, ChevronRight } from 'lucide-react'

interface OwedBannerProps {
  /** Color de la compañía: la franja de la izquierda */
  readonly color: string
  readonly name: string
  /** Monto ya formateado */
  readonly amount: string
  /** Qué falta cobrar (se une con " · ") */
  readonly details: readonly string[]
  readonly onReview: () => void
}

/** Aviso "X te debe $Y" de una compañía. Lo usan Por Hora y Por Pago. */
export function OwedBanner({ color, name, amount, details, onReview }: OwedBannerProps) {
  return (
    <button
      type="button"
      onClick={onReview}
      className="relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-left shadow-sm transition-colors hover:bg-amber-50 animate-card-in touch-manipulation"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: color }} />
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
        <Banknote className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[15px] font-bold text-amber-900">
          {name} te debe <span className="tabular-nums">{amount}</span>
        </span>
        {details.length > 0 && <span className="block text-[12px] text-amber-800">{details.join(' · ')}</span>}
      </span>
      <span className="flex flex-shrink-0 items-center gap-0.5 text-[13px] font-semibold text-amber-900">
        Revisar
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  )
}

/** "1 día" / "3 días": el número con la palabra en singular o plural */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}
