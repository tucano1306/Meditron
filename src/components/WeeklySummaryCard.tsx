'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatShortDateFlorida, formatDuration } from '@/lib/utils'
import { BarChart3, Calendar, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, TrendingUp, DollarSign, Clock, AlertTriangle, X, BadgeCheck, Plus, Trash2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

const ITEMS_PER_PAGE = 5

interface TimeEntry {
  id: string
  date: string
  jobNumber: string | null
  vehicle: string | null
  duration: number | null
  companyPaid: number | null
  calculatedAmount: number | null
  paidAmount: number | null
  correctionPending: boolean
  correctionNote: string | null
  correctionResolved: boolean
  correctionResolvedNote: string | null
}

interface WeekData {
  id: string
  weekNumber: number
  year: number
  month: number
  startDate: string
  endDate: string
  totalHours: number
  earnings: number
  entries: TimeEntry[]
  // Campos calculados
  totalCompanyPaid: number
  entryCount: number
  paidEntryCount: number
}

interface WeeklySummaryCardProps {
  readonly refreshTrigger?: number
  readonly onRefresh?: () => void
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const startDay = start.getUTCDate()
  const endDay = end.getUTCDate()
  const startMonth = start.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' })
  const endMonth = end.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' })
  
  if (startMonth === endMonth) {
    return `${startDay} - ${endDay} ${startMonth}`
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`
}

interface EntryCardProps {
  entry: TimeEntry
  deletingEntryId: string | null
  resolveEntryId: string | null
  correctionEntryId: string | null
  resolveNote: string
  correctionNote: string
  savingCorrection: boolean
  onToggleCorrection: (entry: TimeEntry) => void
  onMarkResolved: (entry: TimeEntry) => void
  onSaveCorrection: (entryId: string, pending: boolean, note: string | null, resolved: boolean, resolvedNote?: string | null) => void
  onSetDeletingEntryId: (id: string | null) => void
  onDeleteEntry: (id: string) => void
  onSetResolveNote: (v: string) => void
  onSetCorrectionNote: (v: string) => void
  onCancelResolve: () => void
  onCancelCorrection: () => void
}

function entryBorderClass(pending: boolean, resolved: boolean): string {
  if (pending) return 'border-orange-300 ring-1 ring-orange-200'
  if (resolved) return 'border-blue-200 ring-1 ring-blue-100'
  return 'border-gray-100'
}

function entryHeaderBg(pending: boolean, resolved: boolean): string {
  if (pending) return 'bg-orange-50'
  if (resolved) return 'bg-blue-50'
  return 'bg-gray-50'
}

function EntryCard({
  entry, deletingEntryId, resolveEntryId, correctionEntryId,
  resolveNote, correctionNote, savingCorrection,
  onToggleCorrection, onMarkResolved, onSaveCorrection,
  onSetDeletingEntryId, onDeleteEntry,
  onSetResolveNote, onSetCorrectionNote,
  onCancelResolve, onCancelCorrection,
}: Readonly<EntryCardProps>) {
  const calc = entry.calculatedAmount ?? 0
  const paid = entry.paidAmount ?? null
  const companyPaid = entry.companyPaid ?? null
  const diff = companyPaid === null ? null : companyPaid - calc
  const isPending = entry.correctionPending
  const isResolved = entry.correctionResolved

  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden border ${entryBorderClass(isPending, isResolved)}`}>
      {/* Cabecera: fecha + estado */}
      <div className={`flex items-center justify-between px-3 py-2 ${entryHeaderBg(isPending, isResolved)}`}>
        <span className="text-xs font-semibold text-gray-700">{formatShortDateFlorida(entry.date)}</span>
        <div className="flex items-center gap-1">
          {isPending && (
            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" /> PENDIENTE
            </span>
          )}
          {isResolved && (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full flex items-center gap-0.5">
              <BadgeCheck className="h-2.5 w-2.5" /> CORREGIDO
            </span>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 border-b border-gray-100">
        {entry.jobNumber && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">#{entry.jobNumber}</span>
        )}
        {entry.vehicle && (
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-full">🚗 {entry.vehicle}</span>
        )}
        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded-full flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" /> {formatDuration(entry.duration ?? 0)}
        </span>
      </div>

      {/* Financiero */}
      <div className="grid grid-cols-2 divide-x divide-gray-100">
        <div className="px-3 py-2">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Calculado</div>
          <div className="text-sm font-bold text-gray-700">{formatCurrency(calc)}</div>
          {paid !== null && <div className="text-[10px] text-gray-400 mt-0.5">pago: {formatCurrency(paid)}</div>}
        </div>
        <div className={`px-3 py-2 ${companyPaid === null ? '' : 'bg-emerald-50'}`}>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Empresa</div>
          {companyPaid === null ? (
            <span className="text-xs text-gray-400 italic">sin pago</span>
          ) : (
            <div>
              <div className="text-sm font-bold text-emerald-700">{formatCurrency(companyPaid)}</div>
              {diff !== null && diff !== 0 && (
                <div className={`text-[10px] font-semibold mt-0.5 ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {diff > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(diff))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-1 flex-wrap px-3 py-1.5 border-t border-gray-100 bg-gray-50">
        {!isResolved && (
          <button
            type="button"
            onClick={() => onToggleCorrection(entry)}
            disabled={savingCorrection}
            className={`text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-0.5 ${
              isPending
                ? 'bg-orange-200 text-orange-800 hover:bg-orange-300'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-700'
            }`}
          >
            {isPending ? <><X className="h-2.5 w-2.5" /> Quitar pendiente</> : <><AlertTriangle className="h-2.5 w-2.5" /> Corrección</>}
          </button>
        )}
        {isPending && !isResolved && (
          <button
            type="button"
            onClick={() => onMarkResolved(entry)}
            disabled={savingCorrection}
            className="text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-0.5 bg-blue-500 text-white hover:bg-blue-600"
          >
            <BadgeCheck className="h-2.5 w-2.5" /> Corregido
          </button>
        )}
        {isResolved && (
          <button
            type="button"
            onClick={() => onSaveCorrection(entry.id, false, null, false, null)}
            disabled={savingCorrection}
            className="text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-0.5 bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-2.5 w-2.5" /> Deshacer
          </button>
        )}
        <EntryDeleteButton
          isConfirming={deletingEntryId === entry.id}
          onInitiate={() => onSetDeletingEntryId(entry.id)}
          onConfirm={() => onDeleteEntry(entry.id)}
          onCancel={() => onSetDeletingEntryId(null)}
        />
      </div>

      {/* Notas */}
      {isPending && entry.correctionNote && (
        <div className="mx-3 mb-2 text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5 italic">
          📝 {entry.correctionNote}
        </div>
      )}
      {isResolved && entry.correctionResolvedNote && (
        <div className="mx-3 mb-2 text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 italic flex items-start gap-1">
          <BadgeCheck className="h-3 w-3 mt-0.5 flex-shrink-0" />
          {entry.correctionResolvedNote}
        </div>
      )}

      {/* Modal resolución */}
      {resolveEntryId === entry.id && (
        <div className="mx-3 mb-2 bg-blue-50 border border-blue-300 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-800">¿En qué semana/pago pusieron el dinero faltante?</p>
          <textarea
            className="w-full text-xs border border-blue-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            rows={2}
            placeholder="Ej: Lo pusieron en la semana 18, pago del viernes..."
            value={resolveNote}
            onChange={e => onSetResolveNote(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onCancelResolve} className="text-xs px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="button" disabled={savingCorrection} onClick={() => onSaveCorrection(entry.id, false, null, true, resolveNote.trim() || null)} className="text-xs px-3 py-1 rounded-full bg-blue-500 text-white hover:bg-blue-600 font-semibold">
              {savingCorrection ? 'Guardando...' : 'Confirmar corregido'}
            </button>
          </div>
        </div>
      )}

      {/* Modal corrección */}
      {correctionEntryId === entry.id && (
        <div className="mx-3 mb-2 bg-orange-50 border border-orange-300 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-orange-800">¿Por qué necesita corrección?</p>
          <textarea
            className="w-full text-xs border border-orange-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-orange-400"
            rows={2}
            placeholder="Ej: El monto recibido no coincide, falta $X..."
            value={correctionNote}
            onChange={e => onSetCorrectionNote(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onCancelCorrection} className="text-xs px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="button" disabled={savingCorrection} onClick={() => onSaveCorrection(entry.id, true, correctionNote.trim() || null, false)} className="text-xs px-3 py-1 rounded-full bg-orange-500 text-white hover:bg-orange-600 font-semibold">
              {savingCorrection ? 'Guardando...' : 'Marcar pendiente'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function weekCardClassName(expanded: boolean): string {
  return expanded ? 'bg-white shadow-md ring-2 ring-emerald-400' : 'bg-gray-50 shadow-sm ring-1 ring-gray-200'
}
function weekButtonClassName(expanded: boolean): string {
  return expanded ? 'bg-emerald-50' : 'hover:bg-gray-100'
}
function hoursTextClassName(expanded: boolean): string {
  return expanded ? 'font-bold text-sm text-emerald-700' : 'font-bold text-sm text-gray-700'
}

interface DifferenceRowProps {
  difference: number
  allPaid: boolean
}

function DifferenceRow({ difference, allPaid }: Readonly<DifferenceRowProps>) {
  const isPositive = difference >= 0
  return (
    <div className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-md ${
      isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      <span className="font-medium">
        {isPositive ? '✓ A favor' : '✗ En contra'}
        {!allPaid && <span className="text-[10px] opacity-75 ml-1">(parcial)</span>}
      </span>
      <span className="font-bold">{isPositive ? '+' : ''}{formatCurrency(difference)}</span>
    </div>
  )
}

interface EntryDeleteButtonProps {
  isConfirming: boolean
  onInitiate: () => void
  onConfirm: () => void
  onCancel: () => void
}

function EntryDeleteButton({ isConfirming, onInitiate, onConfirm, onCancel }: Readonly<EntryDeleteButtonProps>) {
  if (isConfirming) {
    return (
      <span className="flex items-center gap-1">
        <button type="button" onClick={onConfirm} className="text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-0.5 bg-red-500 text-white hover:bg-red-600">Sí, borrar</button>
        <button type="button" onClick={onCancel} className="text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-0.5 bg-gray-100 text-gray-500 hover:bg-gray-200">Cancelar</button>
      </span>
    )
  }
  return (
    <button type="button" onClick={onInitiate} className="text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-0.5 bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600">
      <Trash2 className="h-2.5 w-2.5" /> Borrar
    </button>
  )
}

interface WeekStatusBadgeProps {
  hasPendingCorrections: boolean
  hasResolvedCorrections: boolean
  allPaid: boolean
}

function WeekStatusBadge({ hasPendingCorrections, hasResolvedCorrections, allPaid }: Readonly<WeekStatusBadgeProps>) {
  if (hasPendingCorrections) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300">
        <AlertTriangle className="h-2.5 w-2.5" />
        CORRECCIÓN PENDIENTE
      </span>
    )
  }
  if (hasResolvedCorrections) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-300">
        <BadgeCheck className="h-2.5 w-2.5" />
        CORREGIDO
      </span>
    )
  }
  if (allPaid) {
    return (
      <span className="relative inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow overflow-hidden">
        <CheckCircle2 className="h-2.5 w-2.5" />
        REVISADO
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
      SIN REVISAR
    </span>
  )
}

export function WeeklySummaryCard({ refreshTrigger = 0, onRefresh }: Readonly<WeeklySummaryCardProps>) {
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [correctionEntryId, setCorrectionEntryId] = useState<string | null>(null)
  const [correctionNote, setCorrectionNote] = useState('')
  const [resolveEntryId, setResolveEntryId] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [savingCorrection, setSavingCorrection] = useState(false)
  const [addEntryWeekId, setAddEntryWeekId] = useState<string | null>(null)
  const [addEntryForm, setAddEntryForm] = useState({ date: '', hours: '', minutes: '', jobNumber: '', vehicle: '', calculatedAmount: '', paidAmount: '' })
  const [savingEntry, setSavingEntry] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastAddedWeekId, setLastAddedWeekId] = useState<string | null>(null)
  const [localRefreshKey, setLocalRefreshKey] = useState(0)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)

  const toggleWeek = (id: string) => setExpandedWeek(prev => (prev === id ? null : id))

  const handleToggleCorrection = async (entry: TimeEntry) => {
    // Si ya tiene corrección pendiente, la quitamos directamente
    if (entry.correctionPending) {
      await saveCorrection(entry.id, false, null, false)
      return
    }
    // Si no tiene, abrimos el modal de nota
    setCorrectionEntryId(entry.id)
    setCorrectionNote('')
  }

  const handleMarkResolved = (entry: TimeEntry) => {
    // Abrir formulario inline para capturar la nota de resolución
    setResolveEntryId(entry.id)
    setResolveNote('')
  }

  const saveCorrection = async (entryId: string, pending: boolean, note: string | null, resolved: boolean, resolvedNote?: string | null) => {
    setSavingCorrection(true)
    try {
      await fetch('/api/entries/correction', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, correctionPending: pending, correctionNote: note, correctionResolved: resolved, correctionResolvedNote: resolvedNote ?? null }),
      })
      // Actualizar estado local sin refetch completo
      const updateEntry = (e: TimeEntry) =>
        e.id === entryId
          ? { ...e, correctionPending: pending, correctionNote: pending ? note : null, correctionResolved: resolved, correctionResolvedNote: resolved ? (resolvedNote ?? null) : null }
          : e
      const updateWeek = (week: WeekData) => ({ ...week, entries: week.entries.map(updateEntry) })
      setWeeks(prev => prev.map(updateWeek))
    } finally {
      setSavingCorrection(false)
      setCorrectionEntryId(null)
      setCorrectionNote('')
      setResolveEntryId(null)
      setResolveNote('')
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const res = await fetch(`/api/entries?id=${entryId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        const removeEntry = (week: WeekData) => ({ ...week, entries: week.entries.filter(e => e.id !== entryId) })
        setWeeks(prev => prev.map(removeEntry))
        setLocalRefreshKey(prev => prev + 1)
        onRefresh?.()
      }
    } finally {
      setDeletingEntryId(null)
    }
  }

  const handleAddEntry = async (weekId: string) => {
    const { date, hours, minutes, jobNumber, vehicle, calculatedAmount, paidAmount } = addEntryForm
    if (!date || (hours === '' && minutes === '')) return
    setSavingEntry(true)
    setSaveError(null)
    try {
      const h = Number(hours) || 0
      const m = Number(minutes) || 0
      const calc = calculatedAmount === '' ? undefined : Number(calculatedAmount)
      const paid = paidAmount === '' ? undefined : Number(paidAmount)
      const body: Record<string, unknown> = {
        hours: h,
        minutes: m,
        payment: calc ?? 0,
        hourlyRate: 0,
        date,
      }
      if (jobNumber.trim()) body.jobNumber = jobNumber.trim()
      if (vehicle.trim()) body.vehicle = vehicle.trim()
      if (calc !== undefined) body.calculatedAmount = calc
      if (paid !== undefined) body.paidAmount = paid
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setAddEntryWeekId(null)
        setAddEntryForm({ date: '', hours: '', minutes: '', jobNumber: '', vehicle: '', calculatedAmount: '', paidAmount: '' })
        setLastAddedWeekId(weekId)
        setLocalRefreshKey(prev => prev + 1)
        onRefresh?.()
      } else {
        setSaveError(data.error ?? 'Error al guardar')
      }
    } catch {
      setSaveError('Error de conexión')
    } finally {
      setSavingEntry(false)
    }
  }

  const fetchWeeks = useCallback(async () => {
    try {
      const res = await fetch('/api/weeks')
      const data = await res.json()
      
      if (data.success) {
        // Procesar las semanas para calcular los totales de companyPaid
        const processedWeeks: WeekData[] = data.data.map((week: WeekData) => {
          const totalCompanyPaid = week.entries.reduce((sum: number, entry: TimeEntry) => {
            return sum + (entry.companyPaid || 0)
          }, 0)
          
          const paidEntryCount = week.entries.filter((e: TimeEntry) => e.companyPaid !== null && e.companyPaid > 0).length
          
          return {
            ...week,
            totalCompanyPaid,
            entryCount: week.entries.length,
            paidEntryCount
          }
        })
        
        setWeeks(processedWeeks)
      }
    } catch (error) {
      console.error('Error fetching weeks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWeeks()
  }, [refreshTrigger, fetchWeeks, localRefreshKey])

  // Paginación
  const totalPages = Math.ceil(weeks.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedWeeks = weeks.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6 py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Resumen Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-4">
          <div className="text-center text-gray-500 py-6 text-sm">
            Cargando...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (weeks.length === 0) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6 py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Resumen Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-4">
          <div className="text-center text-gray-500 py-6 text-sm">
            No hay datos semanales
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calcular el máximo para las barras de progreso
  const maxHours = Math.max(...weeks.map(w => w.totalHours), 1)

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6 py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Resumen Semanal
          <span className="text-xs font-normal text-gray-500">({weeks.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4">
        <div className="space-y-3">
          {paginatedWeeks.map((week) => {
            const completedEntries = week.entries.filter(e => e.duration !== null)
            const totalCalculated = completedEntries.reduce((s, e) => s + (e.calculatedAmount ?? 0), 0)
            const difference = week.totalCompanyPaid - totalCalculated
            const hasPayments = week.paidEntryCount > 0
            const allPaid = week.paidEntryCount === week.entryCount && week.entryCount > 0

            const isExpanded = expandedWeek === week.id
            const hasPendingCorrections = week.entries.some(e => e.correctionPending)
            const hasResolvedCorrections = week.entries.some(e => e.correctionResolved)
            const weekCardClass = weekCardClassName(isExpanded)
            const weekButtonClass = weekButtonClassName(isExpanded)
            const hoursTextClass = hoursTextClassName(isExpanded)

            return (
              <div key={week.id} className={`rounded-xl overflow-hidden transition-all duration-200 ${weekCardClass}`}>
                <button
                  type="button"
                  className={`w-full p-2.5 space-y-2 text-left transition-colors ${weekButtonClass}`}
                  onClick={() => toggleWeek(week.id)}
                >
                {/* Header: Fecha y horas */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span className="font-medium text-sm">
                      {formatDateRange(week.startDate, week.endDate)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Sem {week.weekNumber}
                    </span>
                    <WeekStatusBadge
                      hasPendingCorrections={hasPendingCorrections}
                      hasResolvedCorrections={hasResolvedCorrections}
                      allPaid={allPaid}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={hoursTextClass}>
                      {week.totalHours.toFixed(1)}h
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Fila: Calculado vs Pagado */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded-md p-2 border border-gray-100">
                    <div className="text-gray-500 text-[10px] uppercase tracking-wide">Calculado</div>
                    <div className="font-bold text-blue-600">{formatCurrency(totalCalculated)}</div>
                  </div>
                  <div className={`rounded-md p-2 border ${hasPayments ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                    <div className="text-gray-500 text-[10px] uppercase tracking-wide flex items-center gap-1">
                      Pagado
                      {hasPayments && (
                        <span className="text-[9px] text-gray-400">
                          ({week.paidEntryCount}/{week.entryCount})
                        </span>
                      )}
                    </div>
                    <div className={`font-bold ${hasPayments ? 'text-green-600' : 'text-gray-400'}`}>
                      {hasPayments ? formatCurrency(week.totalCompanyPaid) : 'Sin registrar'}
                    </div>
                  </div>
                </div>

                {/* Diferencia - solo si hay pagos */}
                {hasPayments && (
                  <DifferenceRow difference={difference} allPaid={allPaid} />
                )}

                {/* Barra de progreso */}
                <Progress value={(week.totalHours / maxHours) * 100} className="h-1.5" />
                </button>

                {/* Panel expandido: detalle por trabajo */}
                {isExpanded && (
                  <div className="border-t border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 overflow-hidden">
                    <div className="px-3 py-2 bg-emerald-600 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-white" />
                        <div className="flex flex-col">
                          <span className="text-white text-sm font-bold leading-tight">Detalle de trabajos</span>
                          <span className="text-emerald-200 text-[11px] leading-tight">
                            {formatDateRange(week.startDate, week.endDate)} · Sem {week.weekNumber}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAddEntryWeekId(prev => prev === week.id ? null : week.id)
                          setAddEntryForm({ date: week.startDate.slice(0, 10), hours: '', minutes: '', jobNumber: '', vehicle: '', calculatedAmount: '', paidAmount: '' })
                          setSaveError(null)
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar
                      </button>
                    </div>

                    {/* Success badge */}
                    {lastAddedWeekId === week.id && addEntryWeekId !== week.id && (
                      <div className="px-3 py-1.5 bg-emerald-100 border-b border-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-xs text-emerald-700 font-semibold">Trabajo agregado correctamente</span>
                      </div>
                    )}

                    {/* Métricas resumen — solo si hay entradas */}
                    {completedEntries.length > 0 && (
                      <div className="grid grid-cols-3 gap-0 divide-x divide-emerald-200 border-b border-emerald-200">
                        <div className="flex flex-col items-center py-2 px-1">
                          <Clock className="h-3.5 w-3.5 text-emerald-600 mb-0.5" />
                          <span className="text-[11px] text-gray-500">Horas</span>
                          <span className="text-base font-black text-gray-800">
                            {(completedEntries.reduce((s, e) => s + (e.duration ?? 0), 0) / 3600).toFixed(2)}h
                          </span>
                        </div>
                        <div className="flex flex-col items-center py-2 px-1">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-600 mb-0.5" />
                          <span className="text-[11px] text-gray-500">Calculado</span>
                          <span className="text-base font-black text-emerald-600">
                            {formatCurrency(totalCalculated)}
                          </span>
                        </div>
                        <div className="flex flex-col items-center py-2 px-1">
                          <TrendingUp className="h-3.5 w-3.5 text-blue-500 mb-0.5" />
                          <span className="text-[11px] text-gray-500">Pagado empresa</span>
                          <span className="text-base font-black text-blue-600">
                            {week.totalCompanyPaid > 0 ? formatCurrency(week.totalCompanyPaid) : '—'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Lista de entradas */}
                    {completedEntries.length > 0 ? (
                      <div className="px-2 py-2 space-y-2">
                        {completedEntries.map((entry) => (
                          <EntryCard
                            key={entry.id}
                            entry={entry}
                            deletingEntryId={deletingEntryId}
                            resolveEntryId={resolveEntryId}
                            correctionEntryId={correctionEntryId}
                            resolveNote={resolveNote}
                            correctionNote={correctionNote}
                            savingCorrection={savingCorrection}
                            onToggleCorrection={handleToggleCorrection}
                            onMarkResolved={handleMarkResolved}
                            onSaveCorrection={saveCorrection}
                            onSetDeletingEntryId={setDeletingEntryId}
                            onDeleteEntry={handleDeleteEntry}
                            onSetResolveNote={setResolveNote}
                            onSetCorrectionNote={setCorrectionNote}
                            onCancelResolve={() => { setResolveEntryId(null); setResolveNote('') }}
                            onCancelCorrection={() => { setCorrectionEntryId(null); setCorrectionNote('') }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-4 text-center text-xs text-gray-400">
                        No hay trabajos registrados en esta semana
                      </div>
                    )}

                    {/* Formulario para agregar trabajo */}
                    {addEntryWeekId === week.id && (
                      <div className="border-t border-emerald-200 bg-white px-3 py-3 space-y-2">
                        <p className="text-xs font-bold text-emerald-700">Nuevo trabajo</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <label htmlFor="ae-date" className="text-[10px] text-gray-500 uppercase tracking-wide">Fecha</label>
                            <input
                              id="ae-date"
                              type="date"
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              min={week.startDate.slice(0, 10)}
                              max={week.endDate.slice(0, 10)}
                              value={addEntryForm.date}
                              onChange={e => setAddEntryForm(f => ({ ...f, date: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label htmlFor="ae-hours" className="text-[10px] text-gray-500 uppercase tracking-wide">Horas</label>
                            <input
                              id="ae-hours"
                              type="number"
                              min="0"
                              max="23"
                              placeholder="0"
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              value={addEntryForm.hours}
                              onChange={e => setAddEntryForm(f => ({ ...f, hours: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label htmlFor="ae-minutes" className="text-[10px] text-gray-500 uppercase tracking-wide">Minutos</label>
                            <input
                              id="ae-minutes"
                              type="number"
                              min="0"
                              max="59"
                              placeholder="0"
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              value={addEntryForm.minutes}
                              onChange={e => setAddEntryForm(f => ({ ...f, minutes: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label htmlFor="ae-calc" className="text-[10px] text-gray-500 uppercase tracking-wide">$ Calculado</label>
                            <input
                              id="ae-calc"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              value={addEntryForm.calculatedAmount}
                              onChange={e => setAddEntryForm(f => ({ ...f, calculatedAmount: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label htmlFor="ae-paid" className="text-[10px] text-gray-500 uppercase tracking-wide">$ Pagado empresa</label>
                            <input
                              id="ae-paid"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Opcional"
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              value={addEntryForm.paidAmount}
                              onChange={e => setAddEntryForm(f => ({ ...f, paidAmount: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label htmlFor="ae-job" className="text-[10px] text-gray-500 uppercase tracking-wide">Job #</label>
                            <input
                              id="ae-job"
                              type="text"
                              placeholder="Opcional"
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              value={addEntryForm.jobNumber}
                              onChange={e => setAddEntryForm(f => ({ ...f, jobNumber: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label htmlFor="ae-vehicle" className="text-[10px] text-gray-500 uppercase tracking-wide">Vehículo</label>
                            <input
                              id="ae-vehicle"
                              type="text"
                              placeholder="Opcional"
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              value={addEntryForm.vehicle}
                              onChange={e => setAddEntryForm(f => ({ ...f, vehicle: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                          {saveError && (
                            <p className="text-xs text-red-600 self-center mr-auto">{saveError}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => { setAddEntryWeekId(null); setSaveError(null) }}
                            className="text-xs px-3 py-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={savingEntry || !addEntryForm.date || (addEntryForm.hours === '' && addEntryForm.minutes === '')}
                            onClick={() => handleAddEntry(week.id)}
                            className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold disabled:opacity-50"
                          >
                            {savingEntry ? 'Guardando...' : 'Guardar trabajo'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    {(week.totalCompanyPaid > 0 || completedEntries.length > 0) && (
                      <div className="flex items-center justify-between px-3 py-2 bg-emerald-100 border-t border-emerald-200">
                        <span className="text-xs font-bold text-emerald-800">
                          Total ({week.entryCount} trabajo{week.entryCount === 1 ? '' : 's'})
                        </span>
                        <div className="text-right">
                          <span className="text-base font-black text-emerald-700">{hasPayments ? formatCurrency(week.totalCompanyPaid) : formatCurrency(totalCalculated)}</span>
                          {week.totalHours > 0 && (
                            <div className="text-[11px] text-emerald-600">
                              ≈ {formatCurrency((hasPayments ? week.totalCompanyPaid : totalCalculated) / week.totalHours)}/h efectivos
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-2 touch-manipulation"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-500">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-2 touch-manipulation"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
