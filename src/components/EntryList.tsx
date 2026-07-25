'use client'

import { useState } from 'react'
import {
  formatDuration,
  formatCurrency,
  HOURLY_RATE,
  formatTimeInFlorida,
  formatShortDateFlorida,
} from '@/lib/utils'
import {
  Clock, ChevronDown, ChevronRight, AlertTriangle, BadgeCheck,
  Pencil, Car, Wrench, FileText,
} from 'lucide-react'
import { EntryDetailModal, type ModalEntry } from './EntryDetailModal'

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
}

interface EntryListProps {
  readonly entries: Entry[]
  readonly title?: string
  readonly onDelete?: () => void
  readonly onUpdate?: () => void
  readonly showDate?: boolean
  readonly hourlyRate?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCalculatedAmount(entry: Entry, hourlyRate: number): number {
  return entry.calculatedAmount ?? ((entry.duration ?? 0) / 3600) * hourlyRate
}

// Todas las tarjetas llevan borde negro; el estado se distingue por el fondo
// y por el badge de corrección.
function cardAccentClass(entry: Entry): string {
  if (entry.correctionPending && !entry.correctionResolved) {
    return 'border-black bg-orange-50/60'
  }
  if (entry.correctionResolved) return 'border-black bg-blue-50/50'
  return 'border-black bg-white'
}

function serviceLabel(serviceType?: string | null): string {
  if (serviceType === 'point-to-point') return 'P2P'
  return 'Hourly'
}

// ── Card sub-components ───────────────────────────────────────────────────────

function StatusPill({ entry }: { readonly entry: Entry }) {
  if (entry.correctionPending && !entry.correctionResolved) {
    return (
      <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full border border-orange-300 bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
        <AlertTriangle className="h-2.5 w-2.5" />
        CORRECCIÓN
      </span>
    )
  }
  if (entry.correctionResolved) {
    return (
      <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full border border-blue-300 bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
        <BadgeCheck className="h-2.5 w-2.5" />
        CORREGIDO
      </span>
    )
  }
  return null
}

function EntryChips({ entry }: { readonly entry: Entry }) {
  const chip = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium'
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {entry.jobNumber && (
        <span className={`${chip} bg-[#37352f] font-mono font-semibold text-white`}>
          #{entry.jobNumber}
        </span>
      )}
      {entry.duration !== null && (
        <span className={`${chip} bg-[rgba(55,53,47,0.06)] text-[#37352f]`}>
          <Clock className="h-2.5 w-2.5" />
          {formatDuration(entry.duration)}
        </span>
      )}
      {entry.vehicle && (
        <span className={`${chip} bg-[rgba(55,53,47,0.06)] capitalize text-[#787774]`}>
          <Car className="h-2.5 w-2.5" />
          {entry.vehicle}
        </span>
      )}
      {entry.serviceType && (
        <span className={`${chip} bg-[rgba(55,53,47,0.06)] text-[#787774]`}>
          <Wrench className="h-2.5 w-2.5" />
          {serviceLabel(entry.serviceType)}
        </span>
      )}
    </div>
  )
}

function EntryAmounts({ entry, hourlyRate }: { readonly entry: Entry; readonly hourlyRate: number }) {
  const calc = getCalculatedAmount(entry, hourlyRate)
  const companyPaid = entry.companyPaid ?? entry.paidAmount ?? null
  const diff = companyPaid === null ? null : companyPaid - calc

  let diffNode: React.ReactNode = null
  if (diff !== null && diff !== 0) {
    diffNode = (
      <div className={`text-[11px] font-semibold ${diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {diff > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(diff))}
      </div>
    )
  }

  return (
    <div className="mt-2.5 grid grid-cols-2 divide-x divide-[rgba(55,53,47,0.08)] overflow-hidden rounded-lg bg-[rgba(55,53,47,0.03)]">
      <div className="px-2.5 py-1.5">
        <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Calculado</div>
        <div className="text-[15px] font-bold text-[#37352f]">{formatCurrency(calc)}</div>
      </div>
      <div className="px-2.5 py-1.5">
        <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Pagado empresa</div>
        {companyPaid === null ? (
          <div className="text-[15px] font-medium text-[#c4c3c0]">—</div>
        ) : (
          <>
            <div className="text-[15px] font-bold text-emerald-700">{formatCurrency(companyPaid)}</div>
            {diffNode}
          </>
        )}
      </div>
    </div>
  )
}

interface EntryCardProps {
  readonly entry: Entry
  readonly hourlyRate: number
  readonly showDate: boolean
  readonly onOpen: (entry: Entry, startEditing: boolean) => void
}

function EntryCard({ entry, hourlyRate, showDate, onOpen }: EntryCardProps) {
  const isRunning = entry.endTime === null || entry.duration === null

  const header = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        {showDate && (
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9b9a97]">
            {formatShortDateFlorida(entry.date)}
          </div>
        )}
        <div className="mt-0.5 font-mono text-[15px] font-semibold text-[#37352f]">
          {formatTimeInFlorida(entry.startTime)}
          <span className="mx-1.5 text-[#c4c3c0]">→</span>
          {entry.endTime
            ? formatTimeInFlorida(entry.endTime)
            : <span className="animate-pulse text-[#787774]">En curso</span>}
        </div>
      </div>
      <StatusPill entry={entry} />
    </div>
  )

  // Entrada en curso: se muestra igual pero no se puede abrir (aún no tiene fin)
  if (isRunning) {
    return (
      <div className="h-full rounded-xl border border-dashed border-black bg-white px-3.5 py-3 shadow-sm">
        {header}
        <div className="mt-2 text-[12px] text-[#9b9a97]">
          Detén el cronómetro para poder editar este trabajo
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md ${cardAccentClass(entry)}`}>
      <button
        type="button"
        onClick={() => onOpen(entry, false)}
        aria-label={`Ver detalle del trabajo${entry.jobNumber ? ` #${entry.jobNumber}` : ''}`}
        className="w-full flex-1 px-3.5 py-3 text-left transition-colors touch-manipulation hover:bg-[rgba(55,53,47,0.02)] active:scale-[0.99] active:bg-[rgba(55,53,47,0.05)]"
      >
        {header}
        <EntryChips entry={entry} />
        <EntryAmounts entry={entry} hourlyRate={hourlyRate} />
      </button>

      <div className="flex items-center justify-between gap-2 border-t border-[rgba(55,53,47,0.15)] px-3.5 py-2">
        {entry.observation ? (
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-[#787774]">
            <FileText className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{entry.observation}</span>
          </span>
        ) : (
          <span className="text-[11px] text-[#c4c3c0]">Toca la tarjeta para ver el detalle</span>
        )}
        <button
          type="button"
          onClick={() => onOpen(entry, true)}
          className="flex min-h-[36px] flex-shrink-0 items-center gap-1 rounded-lg bg-[#37352f] px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors touch-manipulation hover:bg-[#2f2d28] active:scale-95"
        >
          <Pencil className="h-3 w-3" />
          Editar
        </button>
      </div>
    </div>
  )
}

// ── Lista ─────────────────────────────────────────────────────────────────────

export function EntryList({
  entries,
  title = 'Entradas de Hoy',
  onDelete,
  onUpdate,
  showDate = false,
  hourlyRate = HOURLY_RATE,
}: Readonly<EntryListProps>) {
  // Las tarjetas se ven de entrada; el encabezado permite plegarlas.
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)

  // Refresca la vista del padre tras guardar o borrar desde el modal.
  const handleRefresh = () => {
    if (onUpdate) onUpdate()
    else onDelete?.()
  }

  const handleOpen = (entry: Entry, startEditing: boolean) => {
    setOpenInEditMode(startEditing)
    setSelectedEntry(entry)
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-[6px] border border-[rgba(55,53,47,0.09)] bg-white px-4 py-8 text-center">
        <Clock className="mx-auto mb-2 h-8 w-8 text-[rgba(55,53,47,0.2)]" />
        <p className="text-[14px] text-[#787774]">{title}</p>
        <p className="mt-1 text-[13px] text-[rgba(55,53,47,0.4)]">No hay entradas registradas</p>
      </div>
    )
  }

  const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
  const totalAmount = entries.reduce((sum, e) => sum + getCalculatedAmount(e, hourlyRate), 0)

  return (
    <>
      <div className={`overflow-hidden rounded-[6px] transition-all duration-200 ${isExpanded ? 'bg-white shadow-md ring-2 ring-emerald-400' : 'bg-gray-50 shadow-sm ring-1 ring-gray-200'}`}>
        <button
          type="button"
          className={`flex w-full items-center justify-between border-b border-[rgba(55,53,47,0.09)] px-4 py-3 transition-colors touch-manipulation ${isExpanded ? 'bg-emerald-50 hover:bg-emerald-50' : 'hover:bg-gray-100'}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-[#787774]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[#787774]" />
            )}
            <Clock className="h-3.5 w-3.5 text-[#787774]" />
            <span className="text-[14px] font-medium text-[#37352f]">{title}</span>
            <span className="rounded-[3px] bg-[rgba(55,53,47,0.08)] px-1.5 py-0.5 font-mono text-[11px] text-[#37352f]">
              {entries.length}
            </span>
          </div>
          {!isExpanded && (
            <div className="flex items-center gap-2 text-[13px] text-[#787774]">
              <span className="font-mono">{formatDuration(totalDuration)}</span>
              <span>·</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          )}
        </button>

        {isExpanded && (
          <div className="grid grid-cols-1 gap-2.5 bg-[#fbfbfa] p-2.5 sm:grid-cols-2">
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                hourlyRate={hourlyRate}
                showDate={showDate}
                onOpen={handleOpen}
              />
            ))}
          </div>
        )}
      </div>

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry as ModalEntry}
          hourlyRate={hourlyRate}
          startInEditMode={openInEditMode}
          onClose={() => setSelectedEntry(null)}
          onUpdate={handleRefresh}
        />
      )}
    </>
  )
}
