'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, ChevronLeft, Clock, Plus, Flame, FileText, X, Check } from 'lucide-react'
import { addDaysToKey, overtimeRulesOf, weekLabel, type Company, type PayRule } from '@/lib/companies'
import { floridaShiftToUTC, getFloridaDateString } from '@/lib/utils'
import { formatKeyShort, formatTime12, hoursDecimal, money, noteText } from '@/lib/report-format'
import { formatHM, formatRange, withAlpha } from '@/lib/display'
import type { PayPeriodSummary, PeriodEntry } from '@/lib/pay-periods'
import { EntryDetailModal, type ModalEntry } from './EntryDetailModal'
import { WeeklyPdfButton } from './WeeklyPdfButton'
import { ExportCard } from './ExportCard'
import { WeeklyReportSender } from './WeeklyReportSender'

// Vistas de una compañía agrupadas por su semana de pago (el día de inicio que
// configuró, con overtime si aplica): lista de semanas, resumen con gráfica y
// registro manual de entrada y salida.

const ITEMS_PER_PAGE = 5
const CHART_WEEKS = 8

interface PayWeeksProps {
  readonly company: Company
  readonly refreshTrigger?: number
  readonly onRefresh?: () => void
}

interface PeriodsData {
  current: PayPeriodSummary
  periods: PayPeriodSummary[]
}

function usePayPeriods(company: Company, refreshTrigger: number) {
  const [data, setData] = useState<PeriodsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch(`/api/pay-periods?companyId=${encodeURIComponent(company.id)}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result.data)
          setError(null)
        } else {
          setError(result.error || `Error al cargar ${company.name}`)
        }
      })
      .catch(() => setError('Error de conexión'))
  }, [company.id, company.name])

  useEffect(() => {
    load()
  }, [load, refreshTrigger])

  return { data, error, reload: load }
}

function latestRate(company: Company): number {
  return company.payRules[company.payRules.length - 1]?.hourlyRate ?? 0
}

function Loading({ company }: { readonly company: Company }) {
  return <div className="py-8 text-center text-[13px] text-[#787774]">Cargando {company.name}...</div>
}

// ── Desglose de una semana ────────────────────────────────────────────────────

/** Barra hacia el límite de overtime (solo con overtime semanal) */
function OvertimeMeter({ period }: { readonly period: PayPeriodSummary }) {
  const ot = overtimeRulesOf(period.rule)
  if (!ot || period.rule.payType !== 'weekly_overtime') return null
  const threshold = ot.thresholdHours * 3600
  const percent = Math.min(period.totalSeconds / threshold, 1) * 100
  const remaining = threshold - period.totalSeconds
  const inOvertime = remaining <= 0
  return (
    <div className="mt-3">
      <div className="h-2.5 rounded-full bg-[rgba(55,53,47,0.08)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${inOvertime ? 'bg-[#d9730d]' : 'bg-[#37352f]'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[11px] text-[#787774]">
        <span>0 h</span>
        <span className={inOvertime ? 'font-semibold text-[#9a4a0b]' : ''}>
          {inOvertime
            ? `${hoursDecimal(-remaining)} h en overtime (${ot.multiplier}x)`
            : `Faltan ${hoursDecimal(remaining)} h para overtime`}
        </span>
        <span>{ot.thresholdHours} h</span>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, accent = false }: { readonly label: string; readonly value: string; readonly sub?: string; readonly accent?: boolean }) {
  return (
    <div className="px-2 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">{label}</div>
      <div className={`text-[15px] font-bold ${accent ? 'text-[#9a4a0b]' : 'text-[#37352f]'}`}>{value}</div>
      {sub && <div className="text-[11px] text-[#787774]">{sub}</div>}
    </div>
  )
}

function rateLabel(rule: PayRule): { regular: string; extra: string | null } {
  const ot = overtimeRulesOf(rule)
  return {
    regular: `Regular · $${rule.hourlyRate}`,
    extra: ot ? `Extra · $${ot.baseRate * ot.multiplier}` : null,
  }
}

function PayBreakdown({ period }: { readonly period: PayPeriodSummary }) {
  const labels = rateLabel(period.rule)
  if (!labels.extra && period.overtimeSeconds === 0) {
    return (
      <div className="grid grid-cols-2 divide-x divide-[rgba(55,53,47,0.08)] rounded-lg bg-[rgba(55,53,47,0.03)]">
        <Stat label="Horas" value={`${hoursDecimal(period.totalSeconds)} h`} />
        <Stat label="Total" value={money(period.totalPay)} />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 divide-x divide-[rgba(55,53,47,0.08)] rounded-lg bg-[rgba(55,53,47,0.03)]">
      <Stat label={labels.regular} value={`${hoursDecimal(period.regularSeconds)} h`} sub={money(period.regularPay)} />
      <Stat label={labels.extra ?? 'Extra'} value={`${hoursDecimal(period.overtimeSeconds)} h`} sub={money(period.overtimePay)} accent={period.overtimeSeconds > 0} />
      <Stat label="Total" value={money(period.totalPay)} />
    </div>
  )
}

function EntryRow({ entry, rule, onOpen }: { readonly entry: PeriodEntry; readonly rule: PayRule; readonly onOpen: (entry: PeriodEntry) => void }) {
  const note = noteText(entry.observation)
  const ot = overtimeRulesOf(rule)
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="w-full text-left rounded-xl border border-black bg-white px-3.5 py-2.5 shadow-sm hover:bg-[rgba(55,53,47,0.02)] active:scale-[0.99] transition-all touch-manipulation"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9b9a97]">
            {formatKeyShort(entry.date.slice(0, 10))}
            {entry.jobNumber && <span className="ml-1.5 normal-case font-mono text-[#37352f]">#{entry.jobNumber}</span>}
          </div>
          <div className="font-mono text-[14px] font-semibold text-[#37352f]">
            {formatTime12(entry.startTime)}
            <span className="mx-1.5 text-[#c4c3c0]">→</span>
            {entry.endTime ? formatTime12(entry.endTime) : ''}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[14px] font-bold text-[#37352f]">{hoursDecimal(entry.duration ?? 0)} h</div>
          <div className="text-[12px] font-semibold text-emerald-700">{money(entry.amount)}</div>
        </div>
      </div>
      {entry.overtimeSeconds > 0 && (
        <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#9a4a0b]">
          <Flame className="h-3 w-3" />
          {hoursDecimal(entry.overtimeSeconds)} h de overtime{ot ? ` a $${ot.baseRate * ot.multiplier}/h` : ''}
        </div>
      )}
      {note && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-[#787774]">
          <FileText className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{note}</span>
        </div>
      )}
    </button>
  )
}

function EntryGrid({ period, onOpenEntry }: { readonly period: PayPeriodSummary; readonly onOpenEntry: (entry: PeriodEntry) => void }) {
  if (period.entries.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-gray-400">
        {period.hasRunningEntry ? 'El turno en curso aparecerá aquí al detener el cronómetro' : 'Sin horas registradas esta semana'}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {period.entries.map(entry => (
        <EntryRow key={entry.id} entry={entry} rule={period.rule} onOpen={onOpenEntry} />
      ))}
    </div>
  )
}

// ── Semanas (lista) ───────────────────────────────────────────────────────────

interface PeriodCardProps {
  readonly period: PayPeriodSummary
  readonly company: Company
  readonly expanded: boolean
  readonly onToggle: () => void
  readonly onOpenEntry: (entry: PeriodEntry) => void
}

function PeriodCard({ period, company, expanded, onToggle, onOpenEntry }: PeriodCardProps) {
  return (
    <div className={`rounded-xl overflow-hidden transition-all duration-200 ${expanded ? 'bg-white shadow-md ring-2 ring-[#37352f]' : 'bg-gray-50 shadow-sm ring-1 ring-gray-200'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 p-3 sm:p-4 text-left hover:bg-[rgba(55,53,47,0.04)] transition-colors touch-manipulation"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
          <div className="min-w-0">
            <div className="font-semibold text-sm sm:text-base text-[#37352f] flex items-center gap-1.5 flex-wrap">
              {formatKeyShort(period.start)} → {formatKeyShort(period.end)}
              {period.overtimeSeconds > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fbecdd] text-[#9a4a0b] border border-[#f5c99f]">
                  <Flame className="h-2.5 w-2.5" />
                  OT {hoursDecimal(period.overtimeSeconds)} h
                </span>
              )}
              {period.hasRunningEntry && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  EN CURSO
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#787774]">
              {period.entries.length} {period.entries.length === 1 ? 'registro' : 'registros'}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-semibold text-sm sm:text-base text-[#37352f]">{hoursDecimal(period.totalSeconds)} h</div>
          <div className="text-emerald-700 font-semibold text-sm">{money(period.totalPay)}</div>
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-[#fbfbfa] p-2.5 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-semibold text-[#37352f]">Detalle de horas</span>
            <WeeklyPdfButton companyId={company.id} date={period.start} label="Descargar PDF" />
          </div>
          <EntryGrid period={period} onOpenEntry={onOpenEntry} />
          <PayBreakdown period={period} />
        </div>
      )}
    </div>
  )
}

/** Pestaña "Semanas": todas las semanas de pago con sus turnos */
export function PayWeeksList({ company, refreshTrigger = 0, onRefresh }: PayWeeksProps) {
  const { data, error, reload } = usePayPeriods(company, refreshTrigger)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selectedEntry, setSelectedEntry] = useState<ModalEntry | null>(null)

  if (error) return <div className="py-8 text-center text-[13px] text-[#dc2626]">{error}</div>
  if (!data) return <Loading company={company} />

  const totalPages = Math.max(1, Math.ceil(data.periods.length / ITEMS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const visible = data.periods.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  return (
    <section className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-3 sm:p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Clock className="h-4 w-4 text-[#787774]" />
        <span className="text-[14px] font-semibold text-[#37352f]">Semanas de {company.name}</span>
        <span className="text-[11px] text-[#787774]">({weekLabel(company.weekStartsOn).toLowerCase()})</span>
      </div>
      {visible.length === 0 ? (
        <div className="py-6 text-center text-[13px] text-[#787774]">
          Aún no hay horas de {company.name}. Inicia el cronómetro o agrega horas.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(period => (
            <PeriodCard
              key={period.start}
              period={period}
              company={company}
              expanded={expanded === period.start}
              onToggle={() => setExpanded(prev => (prev === period.start ? null : period.start))}
              onOpenEntry={entry => setSelectedEntry(entry)}
            />
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} aria-label="Anterior" className="h-8 px-2 rounded-md border border-gray-300 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-500">{currentPage} / {totalPages}</span>
          <button type="button" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} aria-label="Siguiente" className="h-8 px-2 rounded-md border border-gray-300 disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          hourlyRate={latestRate(company)}
          onClose={() => setSelectedEntry(null)}
          onUpdate={() => { reload(); onRefresh?.() }}
        />
      )}
    </section>
  )
}

// ── Resumen (gráfica de las últimas semanas) ──────────────────────────────────

function emptyPeriod(template: PayPeriodSummary, start: string): PayPeriodSummary {
  return {
    ...template, start, end: addDaysToKey(start, 6), entries: [],
    totalSeconds: 0, regularSeconds: 0, overtimeSeconds: 0,
    regularPay: 0, overtimePay: 0, totalPay: 0, companyPaidTotal: 0, hasRunningEntry: false,
  }
}

interface WeeksChartProps {
  readonly weeks: PayPeriodSummary[]
  readonly selected: string
  readonly currentStart: string
  readonly color: string
  readonly onSelect: (start: string) => void
}

/** Rayado del color de la compañía: distingue el overtime con cualquier color */
function overtimeFill(color: string): string {
  return `repeating-linear-gradient(135deg, ${color} 0 4px, ${withAlpha(color, 0.45)} 4px 8px)`
}

// Horas por semana de pago (overtime apilado y rayado); tocar una barra la selecciona
function WeeksChart({ weeks, selected, currentStart, color, onSelect }: WeeksChartProps) {
  const ot = overtimeRulesOf(weeks[weeks.length - 1].rule)
  const threshold = ot && weeks[weeks.length - 1].rule.payType === 'weekly_overtime' ? ot.thresholdHours * 3600 : null
  const scale = Math.max(threshold ?? 40 * 3600, ...weeks.map(w => w.totalSeconds)) * 1.08

  return (
    <div>
      <div className="flex items-end gap-1.5 sm:gap-2" role="listbox" aria-label="Semanas de pago">
        {weeks.map(week => {
          const isSelected = week.start === selected
          const regular = week.totalSeconds - week.overtimeSeconds
          return (
            <button
              key={week.start}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={`Semana ${formatRange(week.start, week.end)}: ${formatHM(week.totalSeconds)}, ${money(week.totalPay)}`}
              onClick={() => onSelect(week.start)}
              className="group flex flex-1 flex-col items-center gap-1 touch-manipulation"
            >
              <span className={`text-[10px] font-semibold tabular-nums transition-opacity ${isSelected ? 'text-[#37352f] opacity-100' : 'text-[#787774] opacity-0 group-hover:opacity-100'}`}>
                {week.totalSeconds > 0 ? `${(week.totalSeconds / 3600).toFixed(1)}h` : '—'}
              </span>
              <div className={`relative flex h-32 w-full flex-col justify-end overflow-hidden rounded-lg transition-colors ${isSelected ? 'bg-[rgba(55,53,47,0.07)]' : 'bg-[rgba(55,53,47,0.03)] group-hover:bg-[rgba(55,53,47,0.06)]'}`}>
                {threshold && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-[#9a4a0b]/50"
                    style={{ bottom: `${(threshold / scale) * 100}%` }}
                  />
                )}
                <div
                  className="w-full rounded-t-md transition-[height] duration-500"
                  style={{ height: `${(week.overtimeSeconds / scale) * 100}%`, background: overtimeFill(color), opacity: isSelected ? 1 : 0.55 }}
                />
                <div
                  className="w-full transition-[height] duration-500"
                  style={{ height: `${(regular / scale) * 100}%`, backgroundColor: color, opacity: isSelected ? 1 : 0.45, borderRadius: week.overtimeSeconds > 0 ? 0 : '6px 6px 0 0' }}
                />
              </div>
              <span className={`text-[10px] leading-tight whitespace-nowrap ${isSelected ? 'font-bold text-[#37352f]' : 'text-[#9b9a97]'}`}>
                {week.start === currentStart ? 'Actual' : formatKeyShort(week.start).split(' ').slice(1).join(' ')}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#787774]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
          Horas regulares
        </span>
        {threshold && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: overtimeFill(color) }} />
              Overtime
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 border-t border-dashed border-[#9a4a0b]" />
              Límite {ot?.thresholdHours} h
            </span>
          </>
        )}
      </div>
    </div>
  )
}

/** Pestaña "Resumen": las últimas semanas en una gráfica y el detalle de la elegida */
export function PayWeeksSummary({ company, refreshTrigger = 0, onRefresh }: PayWeeksProps) {
  const { data, error, reload } = usePayPeriods(company, refreshTrigger)
  const [selected, setSelected] = useState<string | null>(null)
  const [showEntries, setShowEntries] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<ModalEntry | null>(null)

  if (error) return <div className="py-8 text-center text-[13px] text-[#dc2626]">{error}</div>
  if (!data) return <Loading company={company} />

  const weeks = Array.from({ length: CHART_WEEKS }, (_, i) => {
    const start = addDaysToKey(data.current.start, -7 * (CHART_WEEKS - 1 - i))
    if (start === data.current.start) return data.current
    return data.periods.find(p => p.start === start) ?? emptyPeriod(data.current, start)
  })
  const week = weeks.find(w => w.start === selected) ?? data.current
  const worked = weeks.filter(w => w.totalSeconds > 0)
  const totalPay = weeks.reduce((sum, w) => sum + w.totalPay, 0)
  const average = worked.length > 0 ? worked.reduce((sum, w) => sum + w.totalSeconds, 0) / worked.length : 0

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[14px] font-semibold text-[#37352f]">Últimas {CHART_WEEKS} semanas</div>
            <div className="text-[11px] text-[#787774]">Toca una semana para ver su detalle</div>
          </div>
          <div className="text-right">
            <div className="text-[15px] font-bold text-emerald-700 tabular-nums">{money(totalPay)}</div>
            <div className="text-[11px] text-[#787774]">Promedio {formatHM(average)}/sem</div>
          </div>
        </div>
        <WeeksChart
          weeks={weeks}
          selected={week.start}
          currentStart={data.current.start}
          color={company.color}
          onSelect={start => { setSelected(start); setShowEntries(false) }}
        />
      </section>

      <section key={week.start} className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-4 shadow-sm animate-fade-in">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[12px] font-medium uppercase tracking-wide text-[#787774]">
              {week.start === data.current.start ? 'Semana actual' : 'Semana de pago'}
            </div>
            <div className="text-[13px] text-[#37352f] mt-0.5">
              {formatKeyShort(week.start)} → {formatKeyShort(week.end)}
            </div>
          </div>
          <WeeklyPdfButton companyId={company.id} date={week.start} />
        </div>
        <div className="mt-2 text-[30px] font-bold leading-tight text-[#37352f] tabular-nums">
          {hoursDecimal(week.totalSeconds)} h
        </div>
        <OvertimeMeter period={week} />
        <div className="mt-3">
          <PayBreakdown period={week} />
        </div>
        {week.hasRunningEntry && (
          <div className="mt-2 text-[11px] text-[#787774]">
            Hay un turno en curso: sus horas se suman al detener el cronómetro.
          </div>
        )}
        {week.entries.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowEntries(v => !v)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[13px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.05)] transition-colors"
            >
              <span>{showEntries ? 'Ocultar' : 'Ver'} {week.entries.length} {week.entries.length === 1 ? 'turno' : 'turnos'}</span>
              {showEntries ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {showEntries && (
              <div className="mt-2">
                <EntryGrid period={week} onOpenEntry={entry => setSelectedEntry(entry)} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Enviar por correo la semana elegida en la gráfica */}
      <WeeklyReportSender key={week.start} company={company} variant="card" date={week.start} refreshTrigger={refreshTrigger} />

      <ExportCard company={company} />

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          hourlyRate={latestRate(company)}
          onClose={() => setSelectedEntry(null)}
          onUpdate={() => { reload(); onRefresh?.() }}
        />
      )}
    </div>
  )
}

// ── Agregar horas (entrada y salida) ──────────────────────────────────────────

interface AddHoursFormProps {
  readonly company: Company
  readonly onSaved: () => void
  /** Día con el que se abre el formulario (YYYY-MM-DD); por defecto hoy */
  readonly initialDate?: string
  /** Mostrar el formulario abierto desde el inicio */
  readonly startOpen?: boolean
  readonly buttonLabel?: string
}

export function AddHoursForm({ company, onSaved, initialDate, startOpen = false, buttonLabel = 'Agregar horas (entrada y salida)' }: AddHoursFormProps) {
  const [open, setOpen] = useState(startOpen)
  const [date, setDate] = useState(initialDate ?? getFloridaDateString())
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('17:00')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedSummary, setSavedSummary] = useState<string | null>(null)

  const times = floridaShiftToUTC(date, start, end)
  const seconds = times ? Math.floor((times.end.getTime() - times.start.getTime()) / 1000) : 0

  const handleSave = async () => {
    if (!times) {
      setError('Revisa la fecha y las horas')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: times.start.toISOString(),
          endTime: times.end.toISOString(),
          companyId: company.id,
          observation: note.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setOpen(false)
        setNote('')
        setSavedSummary(`${formatHM(seconds)} guardadas el ${formatKeyShort(date)}`)
        onSaved()
      } else {
        setError(data.error || 'No se pudo guardar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {savedSummary && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] font-medium text-emerald-800 animate-fade-in">
            <Check className="h-4 w-4 flex-shrink-0" />
            {savedSummary}
          </div>
        )}
        <button
          type="button"
          onClick={() => { setError(null); setSavedSummary(null); setOpen(true) }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#37352f] bg-white text-[14px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.04)] transition-colors touch-manipulation"
        >
          <Plus className="h-4 w-4" />
          {buttonLabel}
        </button>
      </div>
    )
  }

  const inputClass = 'mt-0.5 w-full px-2 py-2 text-[14px] border border-[rgba(55,53,47,0.16)] rounded-[4px] bg-white focus:outline-none focus:border-[#37352f]'
  return (
    <div className="rounded-xl border border-[#37352f] bg-white p-4 shadow-sm space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[#37352f]">Nuevo registro de horas</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="p-1 rounded-[4px] text-[#787774] hover:bg-[rgba(55,53,47,0.08)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <label className="block text-[11px] text-[#787774]">
        Fecha
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-[#787774]">
          Entrada
          <input type="time" value={start} onChange={e => setStart(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
        </label>
        <label className="block text-[11px] text-[#787774]">
          Salida
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
        </label>
      </div>
      <label className="block text-[11px] text-[#787774]">
        Nota (opcional)
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ej: lugar, cliente, carga..." className={inputClass} style={{ fontSize: '16px' }} />
      </label>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-[#787774]">Total del turno</span>
        <span className="font-semibold text-[#37352f]">{times ? formatHM(seconds) : '—'}</span>
      </div>
      {error && <div className="text-[13px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] py-2 px-3 rounded-[4px]">{error}</div>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !times}
        className="w-full py-3 rounded-[6px] bg-[#37352f] text-white text-[14px] font-semibold hover:bg-[#2f2d28] disabled:opacity-50 transition-colors touch-manipulation"
      >
        {saving ? 'Guardando...' : 'Guardar horas'}
      </button>
    </div>
  )
}
