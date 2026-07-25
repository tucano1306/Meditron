'use client'

import { useState } from 'react'
import { Search, X, Hash, CalendarDays, Clock, DollarSign, Briefcase, Car, Wrench } from 'lucide-react'
import { formatCurrency, formatDuration, formatShortDateFlorida } from '@/lib/utils'
import { EntryDetailModal } from './EntryDetailModal'

type SearchMode = 'job' | 'date'

interface Entry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
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
  updatedAt?: string | null
  createdAt?: string | null
}

interface HourlyEntrySearchProps {
  readonly hourlyRate?: number
}

interface EntryCardProps {
  readonly entry: Entry
  readonly hourlyRate: number
  readonly onOpen: (entry: Entry) => void
}

function EntryResultCard({ entry, hourlyRate, onOpen }: EntryCardProps) {
  const calc =
    entry.calculatedAmount ?? ((entry.duration ?? 0) / 3600) * hourlyRate
  const hasPaid = entry.companyPaid != null
  const diff = hasPaid ? (entry.companyPaid ?? 0) - calc : null
  // Borde negro en todas las tarjetas de resultado
  const borderClass = entry.correctionPending
    ? 'border-black bg-orange-50/50'
    : 'border-black bg-gray-50'

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className={`w-full text-left rounded-xl border transition-all active:scale-[0.98] touch-manipulation ${borderClass}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Briefcase className="h-3.5 w-3.5 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.jobNumber && (
              <span className="text-xs font-bold text-gray-900">#{entry.jobNumber}</span>
            )}
            <span className="text-xs text-gray-500">{formatShortDateFlorida(entry.date)}</span>
            {entry.correctionPending && (
              <span className="text-[10px] font-semibold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                Corrección
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {entry.vehicle && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Car className="h-3 w-3" />
                {entry.vehicle}
              </span>
            )}
            {entry.serviceType && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Wrench className="h-3 w-3" />
                {entry.serviceType}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {entry.duration ? (
            <>
              <div className="flex items-center gap-1 text-xs text-gray-600 justify-end">
                <Clock className="h-3 w-3" />
                {formatDuration(entry.duration)}
              </div>
              <div className="text-xs font-bold text-emerald-600 mt-0.5">
                {formatCurrency(calc)}
              </div>
            </>
          ) : (
            <span className="text-[11px] text-gray-400 animate-pulse">En curso</span>
          )}
        </div>
      </div>
      {hasPaid && diff !== null && (
        <div
          className={`flex items-center justify-between px-3 py-1.5 border-t text-[11px] rounded-b-xl ${
            diff >= 0
              ? 'border-green-100 bg-green-50/60 text-green-700'
              : 'border-red-100 bg-red-50/60 text-red-600'
          }`}
        >
          <span>Pagado por compañía: {formatCurrency(entry.companyPaid ?? 0)}</span>
          <span className="font-bold">
            {diff >= 0 ? '+' : ''}
            {formatCurrency(diff)}
          </span>
        </div>
      )}
      {/* tap hint */}
      <div className="flex items-center justify-end px-3 pb-2">
        <span className="text-[10px] text-gray-400">Ver detalle →</span>
      </div>
    </button>
  )
}

// ── Sub-components to keep main function complexity low ──────────────────────

interface SearchHeaderProps {
  readonly searched: boolean
  readonly mode: SearchMode
  readonly onClear: () => void
  readonly onModeChange: (m: SearchMode) => void
}

function SearchHeader({ searched, mode, onClear, onModeChange }: SearchHeaderProps) {
  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
            <Search className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-gray-900">Buscar Trabajo</span>
        </div>
        {searched && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        )}
      </div>
      <div className="flex rounded-xl bg-gray-100 p-0.5 gap-0.5">
        <ModeTab active={mode === 'job'} onClick={() => onModeChange('job')} icon={<Hash className="h-3.5 w-3.5" />} label="N° Trabajo" />
        <ModeTab active={mode === 'date'} onClick={() => onModeChange('date')} icon={<CalendarDays className="h-3.5 w-3.5" />} label="Por Fecha" />
      </div>
    </div>
  )
}

function ModeTab({ active, onClick, icon, label }: { readonly active: boolean; readonly onClick: () => void; readonly icon: React.ReactNode; readonly label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] text-xs font-semibold transition-all duration-200 ${
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

interface SearchInputPanelProps {
  readonly mode: SearchMode
  readonly jobQuery: string
  readonly dateQuery: string
  readonly canSearch: boolean
  readonly isLoading: boolean
  readonly onJobChange: (v: string) => void
  readonly onDateChange: (v: string) => void
  readonly onSearch: () => void
}

function SearchInputPanel({ mode, jobQuery, dateQuery, canSearch, isLoading, onJobChange, onDateChange, onSearch }: SearchInputPanelProps) {
  const spinner = <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  const btnClass = 'px-4 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all'
  const inputClass = 'w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors bg-gray-50'

  return (
    <div className="px-4 pb-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          {mode === 'job' ? (
            <>
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                inputMode="numeric"
                value={jobQuery}
                onChange={(e) => onJobChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                placeholder="Ej: 216814"
                className={inputClass}
                style={{ fontSize: '16px' }}
              />
            </>
          ) : (
            <>
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={dateQuery}
                onChange={(e) => onDateChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                className={inputClass}
                style={{ fontSize: '16px' }}
              />
            </>
          )}
        </div>
        <button type="button" onClick={onSearch} disabled={!canSearch || isLoading} className={btnClass}>
          {isLoading ? spinner : 'Buscar'}
        </button>
      </div>
    </div>
  )
}

interface SearchResultsPanelProps {
  readonly searched: boolean
  readonly isLoading: boolean
  readonly results: Entry[] | null
  readonly mode: SearchMode
  readonly jobQuery: string
  readonly hourlyRate: number
  readonly onOpenEntry: (entry: Entry) => void
}

function SearchResultsPanel({ searched, isLoading, results, mode, jobQuery, hourlyRate, onOpenEntry }: SearchResultsPanelProps) {
  if (!searched || isLoading || results === null) return null

  const totalHours = results.reduce((acc, e) => acc + (e.duration ?? 0) / 3600, 0)
  const totalAmount = results.reduce(
    (acc, e) => acc + (e.calculatedAmount ?? ((e.duration ?? 0) / 3600) * hourlyRate),
    0
  )

  if (results.length === 0) {
    return (
      <div className="border-t border-gray-100 px-4 py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">Sin resultados</p>
        <p className="text-xs text-gray-400 mt-1">
          {mode === 'job' ? `No se encontró el trabajo #${jobQuery}` : 'No hay entradas para esta fecha'}
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-100 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">
          {results.length} {results.length === 1 ? 'entrada' : 'entradas'}
          {mode === 'job' ? ` · #${jobQuery}` : ''}
        </span>
        {results.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              {totalHours.toFixed(2)}h
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <DollarSign className="h-3 w-3" />
              {formatCurrency(totalAmount)}
            </span>
          </div>
        )}
      </div>
      {results.map((entry) => (
        <EntryResultCard key={entry.id} entry={entry} hourlyRate={hourlyRate} onOpen={onOpenEntry} />
      ))}
    </div>
  )
}

function SearchHint({ mode }: { readonly mode: SearchMode }) {
  return (
    <div className="px-4 pb-4 flex items-center gap-2 text-[11px] text-gray-400">
      <Search className="h-3 w-3 flex-shrink-0" />
      {mode === 'job'
        ? 'Ingresa el número de trabajo para encontrar sus entradas'
        : 'Selecciona una fecha para ver todas las entradas de ese día'}
    </div>
  )
}

export function HourlyEntrySearch({ hourlyRate = 25 }: HourlyEntrySearchProps) {
  const [mode, setMode] = useState<SearchMode>('job')
  const [jobQuery, setJobQuery] = useState('')
  const [dateQuery, setDateQuery] = useState('')
  const [results, setResults] = useState<Entry[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)

  const handleSearch = async () => {
    const param = mode === 'job' ? jobQuery.trim() : dateQuery
    if (!param) return
    setIsLoading(true)
    setSearched(true)
    try {
      const key = mode === 'job' ? 'jobNumber' : 'date'
      const val = mode === 'job' ? encodeURIComponent(param) : param
      const res = await fetch(`/api/entries?${key}=${val}`)
      const data = await res.json()
      setResults(data.success ? (data.data as Entry[]) : [])
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setJobQuery('')
    setDateQuery('')
    setResults(null)
    setSearched(false)
  }

  const handleModeChange = (newMode: SearchMode) => {
    if (newMode === mode) return
    setMode(newMode)
    setResults(null)
    setSearched(false)
  }

  const activeQuery = mode === 'job' ? jobQuery.trim() : dateQuery
  const canSearch = activeQuery.length > 0

  return (
    <>
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <SearchHeader
          searched={searched}
          mode={mode}
          onClear={handleClear}
          onModeChange={handleModeChange}
        />
        <SearchInputPanel
          mode={mode}
          jobQuery={jobQuery}
          dateQuery={dateQuery}
          canSearch={canSearch}
          isLoading={isLoading}
          onJobChange={setJobQuery}
          onDateChange={setDateQuery}
          onSearch={handleSearch}
        />
        <SearchResultsPanel
          searched={searched}
          isLoading={isLoading}
          results={results}
          mode={mode}
          jobQuery={jobQuery}
          hourlyRate={hourlyRate}
          onOpenEntry={setSelectedEntry}
        />
        {!searched && <SearchHint mode={mode} />}
      </div>

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          hourlyRate={hourlyRate}
          onClose={() => setSelectedEntry(null)}
          onUpdate={handleSearch}
        />
      )}
    </>
  )
}
