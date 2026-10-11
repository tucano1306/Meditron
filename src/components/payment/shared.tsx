'use client'

import type { ReactNode } from 'react'
import { Banknote, CreditCard, FileCheck, Landmark, Smartphone, Wallet, Zap } from 'lucide-react'
import type { PaymentMethod } from '@/lib/payment-jobs'

// Piezas visuales compartidas del modo "Por pago".

/** Color de identidad del modo por pago */
export const PAY_ACCENT = '#2e75cc'

export const METHOD_ICONS: Record<PaymentMethod, ReactNode> = {
  cash: <Banknote className="h-3.5 w-3.5" />,
  zelle: <Zap className="h-3.5 w-3.5" />,
  card: <CreditCard className="h-3.5 w-3.5" />,
  check: <FileCheck className="h-3.5 w-3.5" />,
  transfer: <Landmark className="h-3.5 w-3.5" />,
  app: <Smartphone className="h-3.5 w-3.5" />,
  other: <Wallet className="h-3.5 w-3.5" />,
}

export function PendingPill({ small = false }: { readonly small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-amber-100 font-semibold text-amber-800 ring-1 ring-amber-200 ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Por cobrar
    </span>
  )
}

/** Color del $/h comparado con el promedio: verde si está arriba, ámbar si está abajo */
export function RateBadge({ rate, average }: { readonly rate: number; readonly average?: number }) {
  let tone = 'bg-[rgba(55,53,47,0.06)] text-[#37352f]'
  if (average && average > 0) {
    if (rate >= average * 1.05) tone = 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    else if (rate < average * 0.9) tone = 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
  }
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${tone}`}>
      ${rate.toFixed(2)}/h
    </span>
  )
}

/** "Hoy", "Ayer" o "sáb 10 oct" */
export function relativeDayLabel(dateKey: string, today: string, longLabel: string): string {
  if (dateKey === today) return 'Hoy'
  const [y, m, d] = today.split('-').map(Number)
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
  if (dateKey === yesterday) return 'Ayer'
  return longLabel
}
