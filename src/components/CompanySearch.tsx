'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Hash, Loader2 } from 'lucide-react'
import { addDaysToKey, DAY_NAMES, dateKeyToUTC, getPayPeriod, ruleFor, toDateKey, type Company } from '@/lib/companies'
import { formatCurrency, getFloridaDateString, getMonthName } from '@/lib/utils'
import { formatHM, formatRange, textOn, withAlpha } from '@/lib/display'
import { EntryList } from './EntryList'
import { JobSearch } from './JobSearch'
import { AddHoursForm } from './PayWeeks'

// Búsqueda de la pestaña "Buscar": por día (calendario con las horas de cada
// día, ordenado por la semana de pago de la compañía) y, si la compañía registra
// números de trabajo, también por trabajo.

const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
/** Horas de un día que pintan la celda con el color más intenso */
const FULL_DAY_SECONDS = 10 * 3600

interface Entry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
  companyId?: string | null
  jobNumber?: string | null
  vehicle?: string | null
  serviceType?: string | null
  observation?: string | null
  calculatedAmount?: number | null
  paidAmount?: number | null
  companyPaid?: number | null
  correctionPending?: boolean
  correctionNote?: string | null
  correctionResolved?: boolean
  correctionResolvedNote?: string | null
}

interface DayTotals {
  seconds: number
  amount: number
  entries: Entry[]
}

interface CompanySearchProps {
  readonly company: Company
  readonly refreshTrigger?: number
  readonly onRefresh?: () => void
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function lastDayOfMonth(year: number, month: number): string {
  const next = month === 12 ? monthKey(year + 1, 1) : monthKey(year, month + 1)
  return addDaysToKey(`${next}-01`, -1)
}

function sumDays(byDay: Map<string, DayTotals>, from: string, to: string): { seconds: number; amount: number; count: number } {
  let seconds = 0
  let amount = 0
  let count = 0
  for (const [key, day] of byDay) {
    if (key < from || key > to) continue
    seconds += day.seconds
    amount += day.amount
    count += day.entries.filter(e => e.duration !== null).length
  }
  return { seconds, amount, count }
}

// ── Calendario por día ────────────────────────────────────────────────────────

function DaySearch({ company, refreshTrigger = 0, onRefresh }: CompanySearchProps) {
  const today = getFloridaDateString()
  const [view, setView] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }))
  const [selected, setSelected] = useState(today)
  const [reloadToken, setReloadToken] = useState(0)
  const [loaded, setLoaded] = useState<{ key: string; entries: Entry[] } | null>(null)

  const monthStart = `${monthKey(view.year, view.month)}-01`
  const monthEnd = lastDayOfMonth(view.year, view.month)
  // Filas completas de semanas de pago: cada fila es una semana de la compañía
  const gridStart = getPayPeriod(monthStart, company.weekStartsOn).start
  const gridEnd = getPayPeriod(monthEnd, company.weekStartsOn).end
  const requestKey = `${company.id}|${gridStart}|${gridEnd}|${refreshTrigger}|${reloadToken}`

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ companyId: company.id, from: gridStart, to: gridEnd })
    fetch(`/api/entries?${params}`)
      .then(res => res.json())
      .then(json => {
        if (!cancelled) setLoaded({ key: requestKey, entries: json.success ? json.data : [] })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: requestKey, entries: [] })
      })
    return () => { cancelled = true }
  }, [company.id, gridStart, gridEnd, requestKey])

  const isLoading = loaded?.key !== requestKey
  const byDay = new Map<string, DayTotals>()
  for (const entry of loaded?.entries ?? []) {
    const key = toDateKey(entry.date)
    const day = byDay.get(key) ?? { seconds: 0, amount: 0, entries: [] }
    const seconds = entry.duration ?? 0
    day.seconds += seconds
    day.amount += entry.calculatedAmount ?? (seconds / 3600) * ruleFor(company, key).hourlyRate
    day.entries.push(entry)
    byDay.set(key, day)
  }

  const days: string[] = []
  for (let key = gridStart; key <= gridEnd; key = addDaysToKey(key, 1)) days.push(key)
  const rows = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))
  const letters = Array.from({ length: 7 }, (_, i) => DAY_LETTERS[(company.weekStartsOn + i) % 7])

  const monthTotals = sumDays(byDay, monthStart, monthEnd)
  const selectedDay = byDay.get(selected)
  const selectedWeek = getPayPeriod(selected, company.weekStartsOn)
  const weekTotals = sumDays(byDay, selectedWeek.start, selectedWeek.end)
  const selectedVisible = selected >= gridStart && selected <= gridEnd
  const selectedDate = dateKeyToUTC(selected)

  const changeMonth = (delta: number) => {
    const index = view.year * 12 + (view.month - 1) + delta
    setView({ year: Math.floor(index / 12), month: (index % 12) + 1 })
  }

  const goToday = () => {
    setView({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) })
    setSelected(today)
  }

  const handleChanged = () => {
    setReloadToken(t => t + 1)
    onRefresh?.()
  }

  const pickDay = (key: string) => {
    setSelected(key)
    // Un día de la fila de otra semana del mes vecino lleva a ese mes
    const [y, m] = key.split('-').map(Number)
    if (y !== view.year || m !== view.month) setView({ year: y, month: m })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-3 sm:p-4 shadow-sm">
        {/* Mes */}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior" className="rounded-lg p-2 text-[#787774] hover:bg-[rgba(55,53,47,0.08)] hover:text-[#37352f] transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center min-w-0">
            <div className="flex items-center justify-center gap-2 text-[16px] font-bold text-[#37352f]">
              {getMonthName(view.month)} {view.year}
              {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9b9a97]" />}
            </div>
            <div className="text-[12px] text-[#787774] tabular-nums">
              {formatHM(monthTotals.seconds)} · {formatCurrency(monthTotals.amount)} · {monthTotals.count} {monthTotals.count === 1 ? 'turno' : 'turnos'}
            </div>
          </div>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente" className="rounded-lg p-2 text-[#787774] hover:bg-[rgba(55,53,47,0.08)] hover:text-[#37352f] transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Calendario: cada fila es una semana de pago, con su total a la derecha */}
        <div className="mt-4 grid grid-cols-[repeat(7,minmax(0,1fr))_2.75rem] gap-1 sm:gap-1.5">
          {letters.map((letter, i) => (
            <div key={`h${i}`} className="pb-1 text-center text-[10px] font-semibold text-[#9b9a97]">{letter}</div>
          ))}
          <div className="pb-1 text-right text-[10px] font-semibold text-[#9b9a97]">Sem.</div>

          {rows.map(row => {
            const rowTotals = sumDays(byDay, row[0], row[6])
            const rowSelected = selected >= row[0] && selected <= row[6]
            return [
              ...row.map(key => {
                const seconds = byDay.get(key)?.seconds ?? 0
                const inMonth = key >= monthStart && key <= monthEnd
                const isSelected = key === selected
                const isToday = key === today
                const isFuture = key > today
                let background = 'transparent'
                if (isSelected) background = company.color
                else if (seconds > 0) background = withAlpha(company.color, 0.14 + 0.5 * Math.min(1, seconds / FULL_DAY_SECONDS))
                const dayDate = dateKeyToUTC(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickDay(key)}
                    aria-pressed={isSelected}
                    aria-label={`${DAY_NAMES[dayDate.getUTCDay()]} ${dayDate.getUTCDate()}: ${seconds > 0 ? formatHM(seconds) : 'sin horas'}`}
                    className={`relative flex h-11 sm:h-14 flex-col items-center justify-center rounded-lg transition-[transform,box-shadow,background-color] duration-150 hover:scale-[1.06] hover:shadow-sm touch-manipulation ${seconds === 0 && !isSelected ? 'hover:bg-[rgba(55,53,47,0.06)]' : ''} ${isToday && !isSelected ? 'ring-2 ring-inset ring-[rgba(55,53,47,0.45)]' : ''}`}
                    style={{ backgroundColor: background, color: isSelected ? textOn(company.color) : '#37352f' }}
                  >
                    <span className={`text-[13px] font-semibold leading-none ${!inMonth || isFuture ? 'opacity-35' : ''}`}>{dayDate.getUTCDate()}</span>
                    {seconds > 0 && (
                      <span className="mt-1 text-[9px] font-semibold leading-none tabular-nums opacity-80">{(seconds / 3600).toFixed(1)}h</span>
                    )}
                  </button>
                )
              }),
              <div
                key={`t${row[0]}`}
                className={`flex items-center justify-end rounded-md pr-0.5 text-[10px] tabular-nums transition-colors ${rowSelected ? 'font-bold text-[#37352f]' : 'text-[#9b9a97]'}`}
                title={`Semana ${formatRange(row[0], row[6])}: ${formatHM(rowTotals.seconds)} · ${formatCurrency(rowTotals.amount)}`}
              >
                {rowTotals.seconds > 0 ? `${(rowTotals.seconds / 3600).toFixed(1)}h` : '—'}
              </div>,
            ]
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[#787774]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: withAlpha(company.color, 0.25) }} />
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: withAlpha(company.color, 0.64) }} />
            Más color = más horas
          </span>
          {(selected !== today || view.year !== Number(today.slice(0, 4)) || view.month !== Number(today.slice(5, 7))) && (
            <button type="button" onClick={goToday} className="rounded-md px-2 py-1 font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] transition-colors">
              Ir a hoy
            </button>
          )}
        </div>
      </section>

      {/* Día elegido */}
      {selectedVisible && (
        <section key={selected} className="space-y-3 animate-fade-in">
          <div className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#787774]">{DAY_NAMES[selectedDate.getUTCDay()]}</div>
                <div className="text-[18px] font-bold text-[#37352f]">
                  {selectedDate.getUTCDate()} de {getMonthName(selectedDate.getUTCMonth() + 1).toLowerCase()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[18px] font-bold text-[#37352f] tabular-nums">{formatHM(selectedDay?.seconds ?? 0)}</div>
                <div className="text-[13px] font-semibold text-emerald-700 tabular-nums">{formatCurrency(selectedDay?.amount ?? 0)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[rgba(55,53,47,0.04)] px-3 py-2 text-[12px]">
              <span className="text-[#787774]">Semana de pago {formatRange(selectedWeek.start, selectedWeek.end)}</span>
              <span className="font-semibold text-[#37352f] tabular-nums">{formatHM(weekTotals.seconds)} · {formatCurrency(weekTotals.amount)}</span>
            </div>
          </div>

          {selectedDay && selectedDay.entries.length > 0 ? (
            <EntryList
              entries={selectedDay.entries}
              title={company.trackJobNumber ? 'Trabajos del día' : 'Turnos del día'}
              hourlyRate={ruleFor(company, selected).hourlyRate}
              showCompanyPaid={company.trackCompanyPaid}
              onUpdate={handleChanged}
              onDelete={handleChanged}
            />
          ) : (
            !isLoading && (
              <div className="rounded-xl border border-dashed border-[rgba(55,53,47,0.16)] px-4 py-6 text-center text-[13px] text-[#787774]">
                {selected > today ? 'Este día aún no llega.' : 'No trabajaste este día.'}
              </div>
            )
          )}

          {selected <= today && (
            <AddHoursForm key={selected} company={company} initialDate={selected} onSaved={handleChanged} buttonLabel="Agregar horas este día" />
          )}
        </section>
      )}
    </div>
  )
}

// ── Búsqueda ──────────────────────────────────────────────────────────────────

type SearchMode = 'day' | 'job'

export function CompanySearch({ company, refreshTrigger = 0, onRefresh }: CompanySearchProps) {
  const [mode, setMode] = useState<SearchMode>(company.trackJobNumber ? 'job' : 'day')
  const today = getFloridaDateString()

  const modes: { value: SearchMode; label: string; icon: ReactNode }[] = [
    { value: 'day', label: 'Por día', icon: <CalendarDays className="h-4 w-4" /> },
    { value: 'job', label: 'Por trabajo', icon: <Hash className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-3">
      {company.trackJobNumber && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[rgba(55,53,47,0.06)] p-1" role="tablist" aria-label="Buscar por">
          {modes.map(m => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-semibold transition-all touch-manipulation ${mode === m.value ? 'bg-white text-[#37352f] shadow-sm' : 'text-[#787774] hover:text-[#37352f]'}`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'day' || !company.trackJobNumber ? (
        <DaySearch company={company} refreshTrigger={refreshTrigger} onRefresh={onRefresh} />
      ) : (
        <JobSearch companyId={company.id} hourlyRate={ruleFor(company, today).hourlyRate} showCompanyPaid={company.trackCompanyPaid} />
      )}
    </div>
  )
}
