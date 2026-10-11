'use client'

import type { ReactNode } from 'react'
import { CalendarDays, Check, Clock, Hourglass, TrendingUp } from 'lucide-react'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { formatHM } from '@/lib/display'
import { formatKeyShort } from '@/lib/report-format'
import type { PaymentSummary } from './data'
import { PAY_ACCENT } from './shared'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function Card({ icon, tint, label, children, onClick }: { readonly icon: ReactNode; readonly tint: string; readonly label: string; readonly children: ReactNode; readonly onClick?: () => void }) {
  const body = (
    <>
      <div className="mb-2.5 flex items-center gap-1.5 text-[#787774]">
        <span className={`rounded-lg p-1.5 ${tint}`}>{icon}</span>
        <span className="truncate text-[12px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      {children}
    </>
  )
  const className = 'rounded-xl border border-[rgba(55,53,47,0.09)] bg-white px-4 py-4 text-left shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md'
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} touch-manipulation`}>{body}</button>
  ) : (
    <div className={className}>{body}</div>
  )
}

function Sub({ children }: { readonly children: ReactNode }) {
  return <div className="mt-1 truncate text-[11px] text-[#787774] tabular-nums">{children}</div>
}

interface PaymentSummaryCardsProps {
  readonly summary: PaymentSummary
  readonly onPendingClick: () => void
}

export function PaymentSummaryCards({ summary, onPendingClick }: PaymentSummaryCardsProps) {
  const { today, week, month, pending, weekDays } = summary
  const maxDay = Math.max(1, ...weekDays.map(d => d.earned))

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card icon={<Clock className="h-3.5 w-3.5 text-blue-500" />} tint="bg-blue-50" label="Hoy">
        <div className="text-[22px] font-bold leading-tight tabular-nums text-[#37352f] sm:text-[26px]">{formatCurrency(today.earned)}</div>
        <Sub>{today.count} {today.count === 1 ? 'trabajo' : 'trabajos'} · {formatHM(today.seconds)}</Sub>
        {today.count > 0 && <Sub>{formatCurrency(today.rate)}/h</Sub>}
      </Card>

      <Card icon={<CalendarDays className="h-3.5 w-3.5 text-emerald-500" />} tint="bg-emerald-50" label="Semana">
        <div className="text-[22px] font-bold leading-tight tabular-nums text-[#37352f] sm:text-[26px]">{formatCurrency(week.earned)}</div>
        {/* Lo ganado cada día de la semana (lunes a domingo) */}
        <div className="mt-2 flex h-7 items-end gap-1" aria-hidden>
          {weekDays.map((day, i) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-0.5" title={`${formatKeyShort(day.date)}: ${formatCurrency(day.earned)}`}>
              <div className="flex h-5 w-full items-end overflow-hidden rounded-sm bg-[rgba(55,53,47,0.06)]">
                <div className="w-full rounded-sm transition-[height] duration-500" style={{ height: `${(day.earned / maxDay) * 100}%`, backgroundColor: day.date === today.date ? PAY_ACCENT : `${PAY_ACCENT}80` }} />
              </div>
              <span className={`text-[8px] leading-none ${day.date === today.date ? 'font-bold text-[#37352f]' : 'text-[#b4b4b0]'}`}>{DAY_LETTERS[i]}</span>
            </div>
          ))}
        </div>
        <Sub>{week.count} trabajos · {week.count > 0 ? `${formatCurrency(week.rate)}/h` : '—'}</Sub>
      </Card>

      <Card icon={<TrendingUp className="h-3.5 w-3.5 text-purple-500" />} tint="bg-purple-50" label={getMonthName(Number(month.start.slice(5, 7)))}>
        <div className="text-[22px] font-bold leading-tight tabular-nums text-[#37352f] sm:text-[26px]">{formatCurrency(month.earned)}</div>
        <Sub>{month.count} trabajos · {formatHM(month.seconds)}</Sub>
        <Sub>{month.tips > 0 ? `Propinas ${formatCurrency(month.tips)}` : month.count > 0 ? `${formatCurrency(month.rate)}/h` : 'Sin trabajos aún'}</Sub>
      </Card>

      <Card
        icon={pending.count > 0 ? <Hourglass className="h-3.5 w-3.5 text-amber-600" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
        tint={pending.count > 0 ? 'bg-amber-50' : 'bg-emerald-50'}
        label="Por cobrar"
        onClick={onPendingClick}
      >
        <div className={`text-[22px] font-bold leading-tight tabular-nums sm:text-[26px] ${pending.count > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
          {formatCurrency(pending.earned)}
        </div>
        <Sub>{pending.count > 0 ? `${pending.count} ${pending.count === 1 ? 'trabajo' : 'trabajos'}` : 'Todo cobrado'}</Sub>
        {pending.oldestDate && <Sub>Desde {formatKeyShort(pending.oldestDate)}</Sub>}
      </Card>
    </div>
  )
}
