'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, Download, Loader2, Pencil, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { formatCurrency, getFloridaDateString } from '@/lib/utils'
import { formatHM } from '@/lib/display'
import { formatKeyLong, formatKeyShort, formatTime12 } from '@/lib/report-format'
import { addDaysToKey, dateKeyToUTC } from '@/lib/companies'
import {
  isCoveredByDayPay, jobEarned, jobTitle, methodLabel, PAYMENT_METHODS, ratePerHour, vehicleLabel, VEHICLES,
  type PaymentJob, type PaymentMethod,
} from '@/lib/payment-jobs'
import {
  activeFilterCount, EMPTY_SEARCH, JOB_SORTS, jobSearchParams, NO_COMPANY, parseJobSearch,
  type JobSearch, type JobSort,
} from '@/lib/payment-search'
import type { PayCompany } from '@/lib/pay-companies'
import { floridaDateKey, useFetchData, type JobsResult } from './data'
import { METHOD_ICONS, PendingPill, RateBadge } from './shared'

// Pestaña "Buscar" del modo por pago: encuentra trabajos por texto, fechas,
// compañía, cobro, método, vehículo, propina y monto, y muestra cada uno con
// todos sus detalles. Lo encontrado se puede exportar tal cual a CSV.

type Period = 'all' | 'month' | 'last_month' | '30d' | 'year' | 'custom'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes pasado' },
  { value: '30d', label: '30 días' },
  { value: 'year', label: 'Este año' },
  { value: 'custom', label: 'Elegir fechas' },
]

const DAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** Resultados que se muestran de una vez */
const PAGE = 25
const STORAGE_KEY = 'meditron_pay_search'
const TYPE_DELAY = 300

interface SearchState {
  search: JobSearch
  period: Period
}

function periodRange(period: Period, today: string, custom: { from: string; to: string }): { from: string; to: string } {
  const monthStart = `${today.slice(0, 7)}-01`
  switch (period) {
    case 'month':
      return { from: monthStart, to: today }
    case 'last_month': {
      const lastDay = addDaysToKey(monthStart, -1)
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay }
    }
    case '30d':
      return { from: addDaysToKey(today, -29), to: today }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today }
    case 'custom':
      // Si quedaron al revés, se buscan igual
      return custom.from && custom.to && custom.from > custom.to ? { from: custom.to, to: custom.from } : custom
    default:
      return { from: '', to: '' }
  }
}

// La búsqueda se recuerda mientras la app está abierta (al cambiar de pestaña)
function loadState(): SearchState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const params = new URLSearchParams(raw)
      const period = PERIODS.find(p => p.value === params.get('p'))?.value ?? 'all'
      return { search: parseJobSearch(params), period }
    }
  } catch { /* sin almacenamiento */ }
  return { search: EMPTY_SEARCH, period: 'all' }
}

function saveState(state: SearchState) {
  try {
    const params = jobSearchParams(state.search)
    params.set('p', state.period)
    sessionStorage.setItem(STORAGE_KEY, params.toString())
  } catch { /* sin almacenamiento */ }
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

function parseMoney(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Marca lo buscado dentro del texto */
function highlight(text: string, query: string): ReactNode {
  const needle = query.replace(/^#/, '').trim().toLowerCase()
  if (!needle) return text
  const lower = text.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push(text.slice(from, at))
    parts.push(<mark key={at} className="rounded-sm bg-yellow-200/80 px-0.5 text-inherit">{text.slice(at, at + needle.length)}</mark>)
    from = at + needle.length
  }
  if (parts.length === 0) return text
  parts.push(text.slice(from))
  return parts
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

// ── Piezas ────────────────────────────────────────────────────────────────────

interface ChipProps {
  readonly active: boolean
  readonly onClick: () => void
  readonly children: ReactNode
  readonly color?: string
  readonly muted?: boolean
}

function Chip({ active, onClick, children, color, muted = false }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors touch-manipulation ${
        active
          ? 'border-[#37352f] bg-[#37352f] text-white'
          : `border-[rgba(55,53,47,0.16)] bg-white text-[#37352f] hover:bg-[rgba(55,53,47,0.05)] ${muted ? 'opacity-60' : ''}`
      }`}
    >
      {color && <span className="h-2 w-2 flex-shrink-0 rounded-full ring-1 ring-white/60" style={{ backgroundColor: color }} aria-hidden />}
      {children}
    </button>
  )
}

function FilterGroup({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#787774]">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Detail({ label, children, wide = false }: { readonly label: string; readonly children: ReactNode; readonly wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-3' : ''}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9a97]">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-[#37352f]">{children}</dd>
    </div>
  )
}

const empty = <span className="text-[#c4c4c0]">—</span>

interface ResultCardProps {
  readonly job: PaymentJob
  readonly query: string
  readonly open: boolean
  readonly averageRate?: number
  readonly onToggle: () => void
  readonly onOpen: (job: PaymentJob) => void
}

function ResultCard({ job, query, open, averageRate, onToggle, onOpen }: ResultCardProps) {
  const earned = jobEarned(job)
  const rate = ratePerHour(earned, job.duration)
  const covered = isCoveredByDayPay(job)
  const title = jobTitle(job)
  const date = dateKeyToUTC(job.date)
  const pending = job.paymentStatus === 'pending'

  return (
    <article className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow ${open ? 'border-[rgba(55,53,47,0.18)] shadow-md' : 'border-[rgba(55,53,47,0.09)]'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-stretch gap-3 p-3 text-left hover:bg-[rgba(55,53,47,0.02)] touch-manipulation">
        {/* Fecha */}
        <div className="flex w-[46px] flex-shrink-0 flex-col items-center justify-center rounded-lg bg-[rgba(55,53,47,0.05)] py-1 leading-none">
          <span className="text-[10px] font-semibold uppercase text-[#787774]">{DAY_SHORT[date.getUTCDay()]}</span>
          <span className="mt-0.5 text-[19px] font-bold tabular-nums text-[#37352f]">{date.getUTCDate()}</span>
          <span className="mt-0.5 text-[10px] text-[#787774]">{MONTH_SHORT[date.getUTCMonth()]} {String(date.getUTCFullYear()).slice(2)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {job.company && <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: job.company.color }} aria-hidden />}
            <span className="truncate text-[14px] font-semibold text-[#37352f]">{highlight(title, query)}</span>
            {pending && <PendingPill small />}
          </div>
          <div className="mt-0.5 text-[12px] tabular-nums text-[#787774]">
            {formatTime12(job.startTime)} → {formatTime12(job.endTime)} · {formatHM(job.duration)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {job.company && job.company.name !== title && (
              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${job.company.color}1a`, color: job.company.color }}>
                {highlight(job.company.name, query)}
              </span>
            )}
            {job.jobNumber && (
              <span className="rounded-md bg-[#37352f] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">#{highlight(job.jobNumber, query)}</span>
            )}
            {job.vehicle && <span className="rounded-md bg-[rgba(55,53,47,0.06)] px-1.5 py-0.5 text-[10px] text-[#787774]">{vehicleLabel(job.vehicle)}</span>}
            {job.paymentMethod && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(55,53,47,0.06)] px-1.5 py-0.5 text-[10px] text-[#787774]">
                {METHOD_ICONS[job.paymentMethod]}
                {methodLabel(job.paymentMethod)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-end justify-between gap-1">
          <span className={`text-[16px] font-bold tabular-nums ${earned > 0 ? 'text-[#0f7b6c]' : 'text-[#9b9a97]'}`}>{formatCurrency(earned)}</span>
          {earned === 0 ? (
            <span className="rounded-md bg-[rgba(55,53,47,0.06)] px-1.5 py-0.5 text-[10px] font-semibold text-[#787774]">{covered ? 'Día ya pagado' : 'Sin pago'}</span>
          ) : (
            <RateBadge rate={rate} average={averageRate} />
          )}
          <ChevronDown className={`h-4 w-4 text-[#9b9a97] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
        </div>
      </button>

      {/* Todos los detalles */}
      {open && (
        <div className="border-t border-[rgba(55,53,47,0.08)] bg-[#fbfbfa] px-3 py-3 animate-card-in">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Detail label="Fecha">{formatKeyLong(job.date)}</Detail>
            <Detail label="Horario"><span className="tabular-nums">{formatTime12(job.startTime)} → {formatTime12(job.endTime)}</span></Detail>
            <Detail label="Duración"><span className="tabular-nums">{formatHM(job.duration)}</span></Detail>
            <Detail label="Compañía">
              {job.company ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: job.company.color }} aria-hidden />
                  {highlight(job.company.name, query)}
                </span>
              ) : 'Sin compañía'}
            </Detail>
            <Detail label={job.company ? 'Descripción' : 'Cliente'}>{job.client ? highlight(job.client, query) : empty}</Detail>
            <Detail label="Trabajo #">{job.jobNumber ? <span className="font-mono font-semibold">{highlight(job.jobNumber, query)}</span> : empty}</Detail>
            <Detail label="Vehículo">{job.vehicle ? highlight(vehicleLabel(job.vehicle) ?? job.vehicle, query) : empty}</Detail>
            <Detail label="Pago"><span className="tabular-nums">{covered ? 'Día ya pagado' : formatCurrency(job.amount)}</span></Detail>
            <Detail label="Propina"><span className="tabular-nums">{job.tip > 0 ? formatCurrency(job.tip) : empty}</span></Detail>
            <Detail label="Total"><span className="font-bold tabular-nums text-[#0f7b6c]">{formatCurrency(earned)}</span></Detail>
            <Detail label="Por hora"><span className="tabular-nums">{earned > 0 ? `${formatCurrency(rate)}/h` : empty}</span></Detail>
            <Detail label="Cómo te pagaron">
              {job.paymentMethod ? (
                <span className="inline-flex items-center gap-1">{METHOD_ICONS[job.paymentMethod]}{methodLabel(job.paymentMethod)}</span>
              ) : empty}
            </Detail>
            <Detail label="Estado">
              {pending ? (
                <span className="font-semibold text-amber-700">Por cobrar</span>
              ) : (
                <span className="font-semibold text-emerald-700">Cobrado{job.paidAt ? ` el ${formatKeyShort(floridaDateKey(job.paidAt))}` : ''}</span>
              )}
            </Detail>
            {job.notes && (
              <Detail label="Notas" wide>
                <span className="whitespace-pre-wrap">{highlight(job.notes, query)}</span>
              </Detail>
            )}
          </dl>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => onOpen(job)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#37352f] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#2f2d28] touch-manipulation"
            >
              <Pencil className="h-3.5 w-3.5" /> Abrir y editar
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface PaymentSearchPanelProps {
  readonly refreshKey: number
  readonly companies: PayCompany[] | null | undefined
  readonly averageRate?: number
  /** Texto con el que se llega desde la búsqueda rápida de Trabajos */
  readonly initialQuery?: string
  readonly onOpen: (job: PaymentJob) => void
}

export function PaymentSearchPanel({ refreshKey, companies, averageRate, initialQuery, onOpen }: PaymentSearchPanelProps) {
  const today = getFloridaDateString()
  const [state, setState] = useState<SearchState>(() => {
    const saved = loadState()
    return initialQuery === undefined ? saved : { ...saved, search: { ...saved.search, q: initialQuery } }
  })
  // Lo que se está escribiendo (texto y montos): se aplica al dejar de escribir
  const [draft, setDraft] = useState(() => ({
    q: state.search.q,
    min: state.search.min === null ? '' : String(state.search.min),
    max: state.search.max === null ? '' : String(state.search.max),
  }))
  const [filtersOpen, setFiltersOpen] = useState(() => activeFilterCount(state.search) > 0)
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const [expandAll, setExpandAll] = useState(false)
  const [shown, setShown] = useState({ key: '', count: PAGE })
  const apply = (change: (prev: SearchState) => SearchState) => {
    setState(prev => {
      const next = change(prev)
      saveState(next)
      return next
    })
  }
  const patch = (values: Partial<JobSearch>) => apply(prev => ({ ...prev, search: { ...prev.search, ...values } }))

  useEffect(() => {
    const values = { q: draft.q.trim(), min: parseMoney(draft.min), max: parseMoney(draft.max) }
    const id = setTimeout(() => {
      setState(prev => {
        if (prev.search.q === values.q && prev.search.min === values.min && prev.search.max === values.max) return prev
        const next = { ...prev, search: { ...prev.search, ...values } }
        saveState(next)
        return next
      })
    }, TYPE_DELAY)
    return () => clearTimeout(id)
  }, [draft])

  const { search, period } = state
  const range = periodRange(period, today, { from: search.from, to: search.to })
  const effective: JobSearch = { ...search, ...range }
  const query = jobSearchParams(effective).toString()
  const { data, loading } = useFetchData<JobsResult>(`/api/payment/jobs?${query}${query ? '&' : ''}r=${refreshKey}`)

  const jobs = data?.jobs ?? []
  const totals = data?.totals
  const count = shown.key === query ? shown.count : PAGE
  const visible = jobs.slice(0, count)
  const filterCount = activeFilterCount(search)
  const companyList = companies ?? []
  const companyName = (id: string) => (id === NO_COMPANY ? 'Sin compañía' : companyList.find(c => c.id === id)?.name ?? 'Compañía')

  const choosePeriod = (value: Period) => {
    apply(prev => {
      if (value !== 'custom' || prev.search.from || prev.search.to) return { ...prev, period: value }
      // Al elegir fechas se empieza por el mes actual
      return { period: value, search: { ...prev.search, from: `${today.slice(0, 7)}-01`, to: today } }
    })
  }

  const clearText = () => {
    setDraft(prev => ({ ...prev, q: '' }))
    patch({ q: '' })
  }

  const clearAmounts = () => {
    setDraft(prev => ({ ...prev, min: '', max: '' }))
    patch({ min: null, max: null })
  }

  const clearAll = () => {
    setDraft({ q: '', min: '', max: '' })
    apply(prev => ({ period: 'all', search: { ...EMPTY_SEARCH, sort: prev.search.sort } }))
  }

  // Lo que está filtrando, con su "x" para quitarlo
  const active: { key: string; label: ReactNode; remove: () => void }[] = []
  if (search.q) active.push({ key: 'q', label: `“${search.q}”`, remove: clearText })
  if (period !== 'all') {
    let label = PERIODS.find(p => p.value === period)?.label ?? ''
    if (period === 'custom') {
      if (range.from && range.to) label = `${formatKeyShort(range.from)} – ${formatKeyShort(range.to)}`
      else if (range.from) label = `Desde ${formatKeyShort(range.from)}`
      else if (range.to) label = `Hasta ${formatKeyShort(range.to)}`
    }
    active.push({ key: 'period', label, remove: () => apply(prev => ({ ...prev, period: 'all' })) })
  }
  if (search.status !== 'all') {
    active.push({ key: 'status', label: search.status === 'paid' ? 'Cobrados' : 'Por cobrar', remove: () => patch({ status: 'all' }) })
  }
  for (const id of search.companyIds) {
    active.push({ key: `c:${id}`, label: companyName(id), remove: () => patch({ companyIds: search.companyIds.filter(c => c !== id) }) })
  }
  for (const method of search.methods) {
    active.push({ key: `m:${method}`, label: methodLabel(method), remove: () => patch({ methods: search.methods.filter(m => m !== method) }) })
  }
  for (const vehicle of search.vehicles) {
    active.push({ key: `v:${vehicle}`, label: vehicleLabel(vehicle), remove: () => patch({ vehicles: search.vehicles.filter(v => v !== vehicle) }) })
  }
  if (search.withTip) active.push({ key: 'tip', label: 'Con propina', remove: () => patch({ withTip: false }) })
  if (search.min !== null || search.max !== null) {
    let label = `${formatCurrency(search.min ?? 0)} – ${formatCurrency(search.max ?? 0)}`
    if (search.max === null) label = `Desde ${formatCurrency(search.min ?? 0)}`
    else if (search.min === null) label = `Hasta ${formatCurrency(search.max)}`
    active.push({ key: 'amount', label, remove: clearAmounts })
  }

  const isOpen = (id: string) => expandAll || opened.has(id)
  const toggleOpen = (id: string) => {
    if (expandAll) {
      // Al cerrar uno con "ver todo" activo, quedan abiertos los demás
      setExpandAll(false)
      setOpened(new Set(visible.map(j => j.id).filter(j => j !== id)))
      return
    }
    setOpened(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportParams = jobSearchParams(effective)
  const exportUrl = `/api/payment/export${exportParams.toString() ? `?${exportParams}` : ''}`
  const paidTotal = totals ? totals.earned - totals.pending : 0
  const average = totals && totals.count > 0 ? totals.earned / totals.count : 0

  return (
    <div className="space-y-4">
      {/* Qué buscar */}
      <section className="space-y-3 rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-3 shadow-sm sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b9a97]" />
          <input
            type="search"
            value={draft.q}
            onChange={e => { const q = e.target.value; setDraft(prev => ({ ...prev, q })) }}
            placeholder="Cliente, compañía, # de trabajo, vehículo o nota"
            aria-label="Buscar trabajos"
            enterKeyHint="search"
            className="w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white py-2.5 pl-9 pr-9 text-[#37352f] placeholder:text-[#b4b4b0] focus:border-[#37352f] focus:outline-none"
            style={{ fontSize: '16px' }}
          />
          {draft.q && (
            <button type="button" onClick={clearText} aria-label="Borrar texto" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9b9a97] hover:text-[#37352f]">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Cuándo */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fechas">
          {PERIODS.map(p => (
            <Chip key={p.value} active={period === p.value} onClick={() => choosePeriod(p.value)}>{p.label}</Chip>
          ))}
        </div>
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[12px] font-medium text-[#787774]">
              Desde
              <input
                type="date"
                value={search.from}
                max={today}
                onChange={e => patch({ from: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-3 py-2 text-[#37352f] focus:border-[#37352f] focus:outline-none"
                style={{ fontSize: '16px' }}
              />
            </label>
            <label className="block text-[12px] font-medium text-[#787774]">
              Hasta
              <input
                type="date"
                value={search.to}
                max={today}
                onChange={e => patch({ to: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-3 py-2 text-[#37352f] focus:border-[#37352f] focus:outline-none"
                style={{ fontSize: '16px' }}
              />
            </label>
          </div>
        )}

        {/* Más filtros y orden */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(v => !v)}
            aria-expanded={filtersOpen}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors touch-manipulation ${filtersOpen ? 'border-[#37352f] bg-[rgba(55,53,47,0.05)] text-[#37352f]' : 'border-[rgba(55,53,47,0.16)] text-[#37352f] hover:bg-[rgba(55,53,47,0.05)]'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {filterCount > 0 && <span className="min-w-[18px] rounded-full bg-[#2e75cc] px-1 text-center text-[11px] leading-[18px] text-white">{filterCount}</span>}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>
          <label className="flex items-center gap-1.5 text-[12px] text-[#787774]">
            <span className="hidden sm:inline">Ordenar</span>
            <select
              value={search.sort}
              onChange={e => patch({ sort: e.target.value as JobSort })}
              aria-label="Ordenar resultados"
              className="rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-2 py-2 text-[13px] font-semibold text-[#37352f] focus:border-[#37352f] focus:outline-none"
            >
              {JOB_SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>

        {filtersOpen && (
          <div className="space-y-4 rounded-xl bg-[rgba(55,53,47,0.03)] p-3 animate-card-in">
            <FilterGroup label="Cobro">
              {([['all', 'Todos'], ['paid', 'Cobrados'], ['pending', 'Por cobrar']] as const).map(([value, label]) => (
                <Chip key={value} active={search.status === value} onClick={() => patch({ status: value })}>{label}</Chip>
              ))}
            </FilterGroup>

            {companyList.length > 0 && (
              <FilterGroup label="Compañía">
                {companyList.map(c => (
                  <Chip key={c.id} active={search.companyIds.includes(c.id)} color={c.color} muted={c.archived} onClick={() => patch({ companyIds: toggle(search.companyIds, c.id) })}>
                    {c.name}{c.archived ? ' (archivada)' : ''}
                  </Chip>
                ))}
                <Chip active={search.companyIds.includes(NO_COMPANY)} onClick={() => patch({ companyIds: toggle(search.companyIds, NO_COMPANY) })}>Sin compañía</Chip>
              </FilterGroup>
            )}

            <FilterGroup label="Cómo te pagaron">
              {PAYMENT_METHODS.map(m => (
                <Chip key={m.value} active={search.methods.includes(m.value)} onClick={() => patch({ methods: toggle<PaymentMethod>(search.methods, m.value) })}>
                  {METHOD_ICONS[m.value]}
                  {m.label}
                </Chip>
              ))}
            </FilterGroup>

            <FilterGroup label="Vehículo">
              {VEHICLES.map(v => (
                <Chip key={v.value} active={search.vehicles.includes(v.value)} onClick={() => patch({ vehicles: toggle(search.vehicles, v.value) })}>{v.label}</Chip>
              ))}
            </FilterGroup>

            <FilterGroup label="Total del trabajo (pago + propina)">
              <div className="grid w-full grid-cols-2 gap-2 sm:max-w-sm">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={draft.min}
                  onChange={e => { const min = e.target.value; setDraft(prev => ({ ...prev, min })) }}
                  placeholder="Mínimo $"
                  aria-label="Total mínimo"
                  className="w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-3 py-2 text-[#37352f] focus:border-[#37352f] focus:outline-none"
                  style={{ fontSize: '16px' }}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={draft.max}
                  onChange={e => { const max = e.target.value; setDraft(prev => ({ ...prev, max })) }}
                  placeholder="Máximo $"
                  aria-label="Total máximo"
                  className="w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-3 py-2 text-[#37352f] focus:border-[#37352f] focus:outline-none"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <Chip active={search.withTip} onClick={() => patch({ withTip: !search.withTip })}>Solo con propina</Chip>
            </FilterGroup>
          </div>
        )}

        {/* Lo que se está filtrando */}
        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-[rgba(55,53,47,0.08)] pt-3">
            {active.map(item => (
              <span key={item.key} className="inline-flex items-center gap-1 rounded-full bg-[#e8f1fb] py-1 pl-2.5 pr-1 text-[12px] font-semibold text-[#1f5a99]">
                {item.label}
                <button type="button" onClick={item.remove} aria-label="Quitar filtro" className="rounded-full p-0.5 hover:bg-[#d3e5f7]">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button type="button" onClick={clearAll} className="ml-1 text-[12px] font-semibold text-[#787774] underline underline-offset-2 hover:text-[#37352f]">
              Limpiar todo
            </button>
          </div>
        )}
      </section>

      {/* Lo encontrado */}
      {!data && loading ? (
        <div className="space-y-2">
          <div className="h-[132px] animate-pulse rounded-xl border border-[rgba(55,53,47,0.09)] bg-white" />
          {[0, 1, 2].map(i => <div key={i} className="h-[84px] animate-pulse rounded-xl border border-[rgba(55,53,47,0.09)] bg-white" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[rgba(55,53,47,0.18)] bg-white px-6 py-10 text-center">
          <SearchX className="mx-auto h-9 w-9 text-[rgba(55,53,47,0.25)]" />
          <p className="mt-3 text-[15px] font-semibold text-[#37352f]">No encontramos trabajos{active.length > 0 ? ' con estos filtros' : ''}</p>
          <p className="mt-1 text-[13px] text-[#787774]">
            {active.length > 0 ? 'Prueba con otras fechas o quita algún filtro.' : 'Cuando guardes trabajos, aquí podrás buscarlos.'}
          </p>
          {active.length > 0 && (
            <button type="button" onClick={clearAll} className="mt-4 rounded-xl bg-[#37352f] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#2f2d28]">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          {totals && (
            <section className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#787774]">
                    {plural(totals.count, 'trabajo encontrado', 'trabajos encontrados')}
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9b9a97]" />}
                  </div>
                  <div className="mt-1 text-[30px] font-bold leading-none tabular-nums text-[#0f7b6c]">{formatCurrency(totals.earned)}</div>
                  <div className="mt-1.5 text-[12px] tabular-nums text-[#787774]">
                    {formatHM(totals.seconds)} · {formatCurrency(totals.rate)}/h · {formatCurrency(average)} por trabajo
                  </div>
                </div>
                <a
                  href={exportUrl}
                  download
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[rgba(55,53,47,0.16)] px-3 py-2 text-[13px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.05)] touch-manipulation"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Exportar</span> CSV
                </a>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-emerald-50 px-2.5 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Cobrado</div>
                  <div className="text-[14px] font-bold tabular-nums text-emerald-800">{formatCurrency(paidTotal)}</div>
                </div>
                <div className="rounded-lg bg-amber-50 px-2.5 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Por cobrar</div>
                  <div className="text-[14px] font-bold tabular-nums text-amber-800">{formatCurrency(totals.pending)}</div>
                </div>
                <div className="rounded-lg bg-[rgba(55,53,47,0.05)] px-2.5 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#787774]">Propinas</div>
                  <div className="text-[14px] font-bold tabular-nums text-[#37352f]">{formatCurrency(totals.tips)}</div>
                </div>
              </div>
            </section>
          )}

          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[12px] text-[#787774]">
              {jobs.length < (totals?.count ?? 0) ? `Mostrando ${visible.length} de ${totals?.count}` : `${visible.length} de ${jobs.length}`}
              {' · '}{JOB_SORTS.find(s => s.value === search.sort)?.label.toLowerCase()}
            </span>
            <button
              type="button"
              onClick={() => { setExpandAll(v => !v); setOpened(new Set()) }}
              className="text-[12px] font-semibold text-[#2e75cc] hover:underline"
            >
              {expandAll ? 'Ocultar detalles' : 'Ver todos los detalles'}
            </button>
          </div>

          <div className={`space-y-2 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {visible.map(job => (
              <ResultCard
                key={job.id}
                job={job}
                query={search.q}
                open={isOpen(job.id)}
                averageRate={averageRate}
                onToggle={() => toggleOpen(job.id)}
                onOpen={onOpen}
              />
            ))}
          </div>

          {jobs.length > visible.length && (
            <button
              type="button"
              onClick={() => setShown({ key: query, count: count + PAGE })}
              className="w-full rounded-xl border border-[rgba(55,53,47,0.16)] bg-white py-2.5 text-[13px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.04)] touch-manipulation"
            >
              Mostrar {Math.min(PAGE, jobs.length - visible.length)} más · quedan {jobs.length - visible.length}
            </button>
          )}
          {data?.truncated && (
            <p className="text-center text-[12px] text-[#9b9a97]">
              Hay más resultados de los que caben en la lista. Acota con fechas o filtros, o descárgalos todos en el CSV.
            </p>
          )}
        </>
      )}
    </div>
  )
}
