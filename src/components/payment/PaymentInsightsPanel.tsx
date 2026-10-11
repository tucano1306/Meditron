'use client'

import { useState } from 'react'
import { Award, Download, Users, Wallet } from 'lucide-react'
import { formatCurrency, getFloridaDateString, getMonthName } from '@/lib/utils'
import { formatHM, formatRange } from '@/lib/display'
import { formatKeyShort } from '@/lib/report-format'
import { addDaysToKey } from '@/lib/companies'
import { jobEarned, jobTitle, methodLabel, ratePerHour, summarizeJobs, type PaymentJob, type PaymentMethod } from '@/lib/payment-jobs'
import { useFetchData, type JobsResult, type PaymentSummary } from './data'
import { METHOD_ICONS, PAY_ACCENT } from './shared'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function Stat({ label, value, tone = 'text-[#37352f]' }: { readonly label: string; readonly value: string; readonly tone?: string }) {
  return (
    <div className="rounded-lg bg-[rgba(55,53,47,0.04)] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9a97]">{label}</div>
      <div className={`mt-0.5 text-[16px] font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}

// ── Semanas ───────────────────────────────────────────────────────────────────

function WeekDetail({ start, refreshKey, onOpen }: { readonly start: string; readonly refreshKey: number; readonly onOpen: (job: PaymentJob) => void }) {
  const end = addDaysToKey(start, 6)
  const { data } = useFetchData<JobsResult>(`/api/payment/jobs?from=${start}&to=${end}&r=${refreshKey}`)
  const jobs = data?.jobs ?? []
  const totals = summarizeJobs(jobs)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToKey(start, i)
    return { date, ...summarizeJobs(jobs.filter(j => j.date === date)) }
  })
  const maxDay = Math.max(1, ...days.map(d => d.earned))
  const best = [...jobs].filter(j => j.duration >= 15 * 60).sort((a, b) => ratePerHour(jobEarned(b), b.duration) - ratePerHour(jobEarned(a), a.duration))[0]

  return (
    <div key={start} className="mt-4 space-y-3 border-t border-[rgba(55,53,47,0.08)] pt-4 animate-fade-in">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-bold text-[#37352f]">Semana {formatRange(start, end)}</span>
        <span className="text-[12px] text-[#787774]">lunes a domingo</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Ganado" value={formatCurrency(totals.earned)} tone="text-[#0f7b6c]" />
        <Stat label="Horas" value={formatHM(totals.seconds)} />
        <Stat label="Por hora" value={totals.count ? formatCurrency(totals.rate) : '—'} />
        <Stat label="Propinas" value={formatCurrency(totals.tips)} />
      </div>
      {/* Por día */}
      <div className="flex items-end gap-1.5" aria-label="Ganado por día">
        {days.map((day, i) => (
          <div key={day.date} className="group/day relative flex flex-1 flex-col items-center gap-1">
            <span className="pointer-events-none absolute -top-6 z-10 whitespace-nowrap rounded-md bg-[#37352f] px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover/day:opacity-100">
              {day.count ? `${formatCurrency(day.earned)} · ${day.count}` : '—'}
            </span>
            <div className="flex h-16 w-full items-end overflow-hidden rounded-md bg-[rgba(55,53,47,0.05)]">
              <div className="w-full rounded-md transition-[height] duration-500" style={{ height: `${(day.earned / maxDay) * 100}%`, backgroundColor: PAY_ACCENT }} />
            </div>
            <span className="text-[10px] text-[#9b9a97]">{DAY_LETTERS[i]}</span>
          </div>
        ))}
      </div>
      {best && (
        <button type="button" onClick={() => onOpen(best)} className="flex w-full items-center gap-3 rounded-lg border border-[rgba(55,53,47,0.09)] px-3 py-2.5 text-left hover:bg-[rgba(55,53,47,0.03)]">
          <Award className="h-4 w-4 flex-shrink-0 text-amber-500" />
          <span className="min-w-0 flex-1 text-[13px] text-[#37352f]">
            Mejor pagado: <span className="font-semibold">{jobTitle(best)}</span>
            <span className="text-[#787774]"> · {formatKeyShort(best.date)}</span>
          </span>
          <span className="text-[13px] font-bold tabular-nums text-[#0f7b6c]">{formatCurrency(ratePerHour(jobEarned(best), best.duration))}/h</span>
        </button>
      )}
    </div>
  )
}

function WeeksChart({ summary, refreshKey, onOpen }: { readonly summary: PaymentSummary; readonly refreshKey: number; readonly onOpen: (job: PaymentJob) => void }) {
  const [selected, setSelected] = useState(summary.week.start)
  const weeks = summary.weeks
  const scale = Math.max(1, ...weeks.map(w => w.earned)) * 1.08
  const worked = weeks.filter(w => w.count > 0)
  const average = worked.length ? worked.reduce((s, w) => s + w.earned, 0) / worked.length : 0

  return (
    <section className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold text-[#37352f]">Últimas 8 semanas</div>
          <div className="text-[11px] text-[#787774]">Toca una semana para ver su detalle</div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-bold tabular-nums text-[#0f7b6c]">{formatCurrency(weeks.reduce((s, w) => s + w.earned, 0))}</div>
          <div className="text-[11px] text-[#787774]">Promedio {formatCurrency(average)}/sem</div>
        </div>
      </div>
      <div className="flex items-end gap-1.5 sm:gap-2" role="listbox" aria-label="Semanas">
        {weeks.map(week => {
          const isSelected = week.start === selected
          return (
            <button
              key={week.start}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={`Semana ${formatRange(week.start, week.end)}: ${formatCurrency(week.earned)}`}
              onClick={() => setSelected(week.start)}
              className="group flex flex-1 flex-col items-center gap-1 touch-manipulation"
            >
              <span className={`text-[10px] font-semibold tabular-nums transition-opacity ${isSelected ? 'opacity-100 text-[#37352f]' : 'opacity-0 text-[#787774] group-hover:opacity-100'}`}>
                {week.earned > 0 ? `$${Math.round(week.earned)}` : '—'}
              </span>
              <div className={`flex h-28 w-full flex-col justify-end overflow-hidden rounded-lg transition-colors ${isSelected ? 'bg-[rgba(55,53,47,0.07)]' : 'bg-[rgba(55,53,47,0.03)] group-hover:bg-[rgba(55,53,47,0.06)]'}`}>
                <div className="w-full transition-[height] duration-500" style={{ height: `${(week.tips / scale) * 100}%`, backgroundColor: `${PAY_ACCENT}66`, opacity: isSelected ? 1 : 0.6 }} />
                <div className="w-full transition-[height] duration-500" style={{ height: `${(week.amount / scale) * 100}%`, backgroundColor: PAY_ACCENT, opacity: isSelected ? 1 : 0.5 }} />
              </div>
              <span className={`whitespace-nowrap text-[10px] ${isSelected ? 'font-bold text-[#37352f]' : 'text-[#9b9a97]'}`}>
                {week.start === summary.week.start ? 'Actual' : formatKeyShort(week.start).split(' ').slice(1).join(' ')}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-[#787774]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PAY_ACCENT }} />Pago</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: `${PAY_ACCENT}66` }} />Propina</span>
      </div>
      <WeekDetail start={selected} refreshKey={refreshKey} onOpen={onOpen} />
    </section>
  )
}

// ── Mes ───────────────────────────────────────────────────────────────────────

function GroupBars({ title, icon, groups, label }: {
  readonly title: string
  readonly icon: React.ReactNode
  readonly groups: PaymentSummary['topClients']
  readonly label: (key: string) => React.ReactNode
}) {
  if (groups.length === 0) return null
  const max = Math.max(1, ...groups.map(g => g.earned))
  return (
    <section className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#37352f]">{icon}{title}</div>
      <div className="space-y-2.5">
        {groups.map(group => (
          <div key={group.key}>
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate text-[#37352f]">{label(group.key)}</span>
              <span className="flex-shrink-0 tabular-nums text-[#787774]">
                <span className="font-semibold text-[#37352f]">{formatCurrency(group.earned)}</span> · {group.count} · {formatCurrency(group.rate)}/h
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgba(55,53,47,0.06)]">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(group.earned / max) * 100}%`, backgroundColor: PAY_ACCENT }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ExportCard() {
  const today = getFloridaDateString()
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const valid = Boolean(from && to && from <= to)
  const inputClass = 'mt-0.5 w-full rounded-[4px] border border-[rgba(55,53,47,0.16)] bg-white px-2 py-1.5 text-[13px] focus:border-[#37352f] focus:outline-none'
  return (
    <section className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#37352f]">
        <Download className="h-4 w-4 text-[#787774]" /> Exportar trabajos
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-[#787774]">Desde<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} /></label>
        <label className="text-[11px] text-[#787774]">Hasta<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} /></label>
      </div>
      <a
        href={valid ? `/api/payment/export?from=${from}&to=${to}` : undefined}
        download
        aria-disabled={!valid}
        className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-[6px] py-2.5 text-[13px] font-semibold transition-colors ${valid ? 'bg-[#37352f] text-white hover:bg-[#2f2d28]' : 'pointer-events-none bg-[rgba(55,53,47,0.08)] text-[#9b9a97]'}`}
      >
        <Download className="h-4 w-4" /> Descargar CSV (Excel)
      </a>
    </section>
  )
}

interface PaymentInsightsPanelProps {
  readonly summary: PaymentSummary
  readonly refreshKey: number
  readonly onOpen: (job: PaymentJob) => void
}

export function PaymentInsightsPanel({ summary, refreshKey, onOpen }: PaymentInsightsPanelProps) {
  const month = summary.month
  const monthName = getMonthName(Number(month.start.slice(5, 7)))

  return (
    <div className="space-y-4">
      <WeeksChart summary={summary} refreshKey={refreshKey} onOpen={onOpen} />

      <section className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-4 shadow-sm">
        <div className="mb-3 text-[14px] font-semibold text-[#37352f]">{monthName} en números</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Ganado" value={formatCurrency(month.earned)} tone="text-[#0f7b6c]" />
          <Stat label="Trabajos" value={String(month.count)} />
          <Stat label="Horas" value={formatHM(month.seconds)} />
          <Stat label="Promedio por hora" value={month.count ? formatCurrency(month.rate) : '—'} />
          <Stat label="Propinas" value={formatCurrency(month.tips)} />
          <Stat label="Por cobrar" value={formatCurrency(month.pending)} tone={month.pending > 0 ? 'text-amber-700' : 'text-[#37352f]'} />
        </div>
        {summary.bestJob && (
          <button type="button" onClick={() => onOpen(summary.bestJob as PaymentJob)} className="mt-3 flex w-full items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-left hover:bg-amber-50">
            <Award className="h-4 w-4 flex-shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 text-[13px] text-[#37352f]">
              Mejor trabajo del mes: <span className="font-semibold">{jobTitle(summary.bestJob)}</span>
            </span>
            <span className="text-[13px] font-bold tabular-nums text-[#0f7b6c]">
              {formatCurrency(ratePerHour(jobEarned(summary.bestJob), summary.bestJob.duration))}/h
            </span>
          </button>
        )}
      </section>

      <GroupBars
        title={`Clientes de ${monthName.toLowerCase()}`}
        icon={<Users className="h-4 w-4 text-[#787774]" />}
        groups={summary.topClients}
        label={key => key}
      />
      <GroupBars
        title="Cómo te pagan"
        icon={<Wallet className="h-4 w-4 text-[#787774]" />}
        groups={summary.byMethod}
        label={key => (
          <span className="inline-flex items-center gap-1.5">
            {METHOD_ICONS[key as PaymentMethod]}
            {methodLabel(key)}
          </span>
        )}
      />
      <ExportCard />
    </div>
  )
}
