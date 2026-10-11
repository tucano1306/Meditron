'use client'

import { useState } from 'react'
import { Briefcase, ChevronLeft, ChevronRight, Loader2, Plus, Search, X } from 'lucide-react'
import { formatCurrency, getFloridaDateString, getMonthName } from '@/lib/utils'
import { formatHM } from '@/lib/display'
import { formatKeyLong, formatTime12 } from '@/lib/report-format'
import { addDaysToKey } from '@/lib/companies'
import { jobEarned, jobTitle, methodLabel, ratePerHour, summarizeJobs, vehicleLabel, type PaymentJob } from '@/lib/payment-jobs'
import { useFetchData, type JobsResult } from './data'
import { METHOD_ICONS, PendingPill, RateBadge, relativeDayLabel } from './shared'

type StatusFilter = 'all' | 'paid' | 'pending'

interface JobCardProps {
  readonly job: PaymentJob
  readonly averageRate?: number
  readonly onOpen: (job: PaymentJob) => void
}

export function JobCard({ job, averageRate, onOpen }: JobCardProps) {
  const earned = jobEarned(job)
  return (
    <button
      type="button"
      onClick={() => onOpen(job)}
      className="group flex w-full items-stretch gap-3 rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-3 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-[rgba(55,53,47,0.18)] hover:shadow-md touch-manipulation active:scale-[0.99]"
    >
      <div className="flex w-[62px] flex-shrink-0 flex-col justify-center border-r border-[rgba(55,53,47,0.08)] pr-2 text-[11px] leading-tight tabular-nums text-[#787774]">
        <span className="font-semibold text-[#37352f]">{formatTime12(job.startTime)}</span>
        <span>{formatTime12(job.endTime)}</span>
        <span className="mt-1 text-[10px]">{formatHM(job.duration)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-[#37352f]">{jobTitle(job)}</span>
          {job.paymentStatus === 'pending' && <PendingPill small />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {job.jobNumber && job.client && (
            <span className="rounded-md bg-[#37352f] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">#{job.jobNumber}</span>
          )}
          {job.vehicle && <span className="rounded-md bg-[rgba(55,53,47,0.06)] px-1.5 py-0.5 text-[10px] text-[#787774]">{vehicleLabel(job.vehicle)}</span>}
          {job.paymentMethod && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(55,53,47,0.06)] px-1.5 py-0.5 text-[10px] text-[#787774]">
              {METHOD_ICONS[job.paymentMethod]}
              {methodLabel(job.paymentMethod)}
            </span>
          )}
          {job.notes && <span className="truncate text-[11px] text-[#9b9a97]">{job.notes}</span>}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end justify-center gap-1">
        <span className="text-[16px] font-bold tabular-nums text-[#0f7b6c]">{formatCurrency(earned)}</span>
        {job.tip > 0 && <span className="text-[10px] text-[#787774] tabular-nums">incl. {formatCurrency(job.tip)} propina</span>}
        <RateBadge rate={ratePerHour(earned, job.duration)} average={averageRate} />
      </div>
    </button>
  )
}

function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { start, end: addDaysToKey(next, -1) }
}

interface PaymentJobsPanelProps {
  readonly refreshKey: number
  readonly averageRate?: number
  readonly onOpen: (job: PaymentJob) => void
  readonly onAdd: () => void
}

export function PaymentJobsPanel({ refreshKey, averageRate, onOpen, onAdd }: PaymentJobsPanelProps) {
  const today = getFloridaDateString()
  const [view, setView] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }))
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const { start, end } = monthBounds(view.year, view.month)
  const searching = query.trim().length >= 2
  const params = new URLSearchParams(searching ? { q: query.trim() } : { from: start, to: end })
  if (status !== 'all') params.set('status', status)
  params.set('r', String(refreshKey))
  const { data, loading } = useFetchData<JobsResult>(`/api/payment/jobs?${params}`)

  const jobs = data?.jobs ?? []
  const totals = summarizeJobs(jobs)
  const byDay = new Map<string, PaymentJob[]>()
  for (const job of jobs) byDay.set(job.date, [...(byDay.get(job.date) ?? []), job])
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  const isCurrentMonth = view.year === Number(today.slice(0, 4)) && view.month === Number(today.slice(5, 7))

  const changeMonth = (delta: number) => {
    const index = view.year * 12 + (view.month - 1) + delta
    setView({ year: Math.floor(index / 12), month: (index % 12) + 1 })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-3 shadow-sm sm:p-4">
        {/* Mes o búsqueda */}
        {searching ? (
          <div className="text-center">
            <div className="text-[15px] font-bold text-[#37352f]">Resultados para “{query.trim()}”</div>
            <div className="text-[12px] text-[#787774] tabular-nums">
              {totals.count} {totals.count === 1 ? 'trabajo' : 'trabajos'} · {formatCurrency(totals.earned)} · en todas las fechas
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior" className="rounded-lg p-2 text-[#787774] hover:bg-[rgba(55,53,47,0.08)] hover:text-[#37352f]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 text-center">
              <div className="flex items-center justify-center gap-2 text-[16px] font-bold text-[#37352f]">
                {getMonthName(view.month)} {view.year}
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9b9a97]" />}
              </div>
              <div className="text-[12px] text-[#787774] tabular-nums">
                {formatCurrency(totals.earned)} · {totals.count} {totals.count === 1 ? 'trabajo' : 'trabajos'} · {formatHM(totals.seconds)}
                {totals.count > 0 && ` · ${formatCurrency(totals.rate)}/h`}
              </div>
            </div>
            <button type="button" onClick={() => changeMonth(1)} disabled={isCurrentMonth} aria-label="Mes siguiente" className="rounded-lg p-2 text-[#787774] hover:bg-[rgba(55,53,47,0.08)] hover:text-[#37352f] disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Buscar y filtrar */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b9a97]" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar cliente, trabajo # o nota"
              className="w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white py-2 pl-9 pr-9 text-[#37352f] placeholder:text-[#b4b4b0] focus:border-[#37352f] focus:outline-none"
              style={{ fontSize: '16px' }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9b9a97] hover:text-[#37352f]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-[rgba(55,53,47,0.06)] p-1 sm:w-auto" role="tablist" aria-label="Filtrar por cobro">
            {([['all', 'Todos'], ['paid', 'Cobrados'], ['pending', 'Por cobrar']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={status === value}
                onClick={() => setStatus(value)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-all touch-manipulation ${status === value ? 'bg-white text-[#37352f] shadow-sm' : 'text-[#787774] hover:text-[#37352f]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Lista por día */}
      {days.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-[rgba(55,53,47,0.18)] bg-white px-6 py-10 text-center">
          <Briefcase className="mx-auto h-9 w-9 text-[rgba(55,53,47,0.25)]" />
          <p className="mt-3 text-[15px] font-semibold text-[#37352f]">
            {searching ? 'No encontramos trabajos con esa búsqueda' : `No hay trabajos en ${getMonthName(view.month).toLowerCase()}`}
          </p>
          <p className="mt-1 text-[13px] text-[#787774]">Usa el cronómetro o agrega un trabajo que ya hiciste.</p>
          <button type="button" onClick={onAdd} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#37352f] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#2f2d28]">
            <Plus className="h-4 w-4" /> Agregar trabajo
          </button>
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {days.map(([date, list]) => {
            const dayTotals = summarizeJobs(list)
            return (
              <section key={date} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2 px-1">
                  <span className="text-[13px] font-bold text-[#37352f]">{relativeDayLabel(date, today, formatKeyLong(date))}</span>
                  <span className="text-[12px] text-[#787774] tabular-nums">
                    {formatCurrency(dayTotals.earned)} · {dayTotals.count} · {formatHM(dayTotals.seconds)}
                  </span>
                </div>
                {list.map(job => (
                  <JobCard key={job.id} job={job} averageRate={averageRate} onOpen={onOpen} />
                ))}
              </section>
            )
          })}
          {data?.truncated && <p className="text-center text-[12px] text-[#9b9a97]">Se muestran los 500 más recientes.</p>}
        </div>
      )}
    </div>
  )
}
