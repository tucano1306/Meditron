'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatShortDateFlorida, formatDuration } from '@/lib/utils'
import { BarChart3, Calendar, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, TrendingUp, DollarSign, Clock, AlertTriangle, X, BadgeCheck, Plus } from 'lucide-react'
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

export function WeeklySummaryCard({ refreshTrigger = 0 }: Readonly<WeeklySummaryCardProps>) {
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
  const [addEntryForm, setAddEntryForm] = useState({ date: '', hours: '', minutes: '', jobNumber: '', vehicle: '', calculatedAmount: '' })
  const [savingEntry, setSavingEntry] = useState(false)

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

  const handleAddEntry = async () => {
    const { date, hours, minutes, jobNumber, vehicle, calculatedAmount } = addEntryForm
    if (!date || (hours === '' && minutes === '')) return
    setSavingEntry(true)
    try {
      const h = Number(hours) || 0
      const m = Number(minutes) || 0
      const calc = calculatedAmount === '' ? undefined : Number(calculatedAmount)
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
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        await fetchWeeks()
        setAddEntryWeekId(null)
        setAddEntryForm({ date: '', hours: '', minutes: '', jobNumber: '', vehicle: '', calculatedAmount: '' })
      }
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
  }, [refreshTrigger, fetchWeeks])

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

            let statusBadge: React.ReactNode
            if (hasPendingCorrections) {
              statusBadge = (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  CORRECCIÓN PENDIENTE
                </span>
              )
            } else if (hasResolvedCorrections && !hasPendingCorrections) {
              statusBadge = (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-300">
                  <BadgeCheck className="h-2.5 w-2.5" />
                  CORREGIDO
                </span>
              )
            } else if (allPaid) {
              statusBadge = (
                <span className="relative inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow overflow-hidden">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  REVISADO
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </span>
              )
            } else {
              statusBadge = (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
                  SIN REVISAR
                </span>
              )
            }

            return (
              <div key={week.id} className="bg-gray-50 rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full p-2.5 space-y-2 text-left"
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
                    {statusBadge}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-gray-700">
                      {week.totalHours.toFixed(1)}h
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
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
                  <div className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-md ${
                    difference >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    <span className="font-medium">
                      {difference >= 0 ? '✓ A favor' : '✗ En contra'}
                      {!allPaid && <span className="text-[10px] opacity-75 ml-1">(parcial)</span>}
                    </span>
                    <span className="font-bold">
                      {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                    </span>
                  </div>
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
                        <span className="text-white text-sm font-bold">Detalle de trabajos</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAddEntryWeekId(prev => prev === week.id ? null : week.id)
                          setAddEntryForm({ date: week.startDate.slice(0, 10), hours: '', minutes: '', jobNumber: '', vehicle: '', calculatedAmount: '' })
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar
                      </button>
                    </div>

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
                      <div className="divide-y divide-emerald-100">
                        {completedEntries.map((entry) => {
                          const calc = entry.calculatedAmount ?? 0
                          const paid = entry.paidAmount ?? null
                          const companyPaid = entry.companyPaid ?? null
                          const diff = companyPaid == null ? null : companyPaid - calc
                          return (
                            <div key={entry.id} className={`px-3 py-2 ${entry.correctionPending ? 'bg-orange-50 border-l-4 border-orange-400' : ''}${entry.correctionResolved && !entry.correctionPending ? 'bg-blue-50 border-l-4 border-blue-400' : ''}`}>
                              {/* Fila principal */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs text-gray-500">{formatShortDateFlorida(entry.date)}</span>
                                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                    {entry.jobNumber && (
                                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                                        #{entry.jobNumber}
                                      </span>
                                    )}
                                    {entry.vehicle && (
                                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded">
                                        🚗 {entry.vehicle}
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">
                                      {formatDuration(entry.duration ?? 0)}
                                    </span>
                                    {entry.correctionPending && (
                                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded flex items-center gap-0.5">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        PENDIENTE
                                      </span>
                                    )}
                                    {entry.correctionResolved && (
                                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded flex items-center gap-0.5">
                                        <BadgeCheck className="h-2.5 w-2.5" />
                                        CORREGIDO
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end flex-shrink-0 text-right gap-0.5">
                                  <span className="text-xs text-gray-400">calc: {formatCurrency(calc)}</span>
                                  {paid != null && (
                                    <span className="text-xs text-gray-600">pagado: {formatCurrency(paid)}</span>
                                  )}
                                  {companyPaid == null ? (
                                    <span className="text-xs text-gray-400 italic">sin pago empresa</span>
                                  ) : (
                                    <>
                                      <span className="text-sm font-bold text-gray-800">empresa: {formatCurrency(companyPaid)}</span>
                                      {diff != null && (
                                        <span className={`text-[11px] font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                          {diff >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(diff))}
                                        </span>
                                      )}
                                    </>
                                  )}
                                  {/* Botones de corrección */}
                                  <div className="mt-1 flex gap-1 flex-wrap justify-end">
                                    {!entry.correctionResolved && (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCorrection(entry)}
                                        disabled={savingCorrection}
                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-0.5 ${
                                          entry.correctionPending
                                            ? 'bg-orange-200 text-orange-800 hover:bg-orange-300'
                                            : 'bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-700'
                                        }`}
                                      >
                                        {entry.correctionPending ? (
                                          <><X className="h-2.5 w-2.5" /> Quitar pendiente</>
                                        ) : (
                                          <><AlertTriangle className="h-2.5 w-2.5" /> Marcar corrección</>
                                        )}
                                      </button>
                                    )}
                                    {entry.correctionPending && !entry.correctionResolved && (
                                      <button
                                        type="button"
                                        onClick={() => handleMarkResolved(entry)}
                                        disabled={savingCorrection}
                                        className="text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-0.5 bg-blue-500 text-white hover:bg-blue-600"
                                      >
                                        <BadgeCheck className="h-2.5 w-2.5" /> Marcar corregido
                                      </button>
                                    )}
                                    {entry.correctionResolved && (
                                      <button
                                        type="button"
                                        onClick={() => saveCorrection(entry.id, false, null, false, null)}
                                        disabled={savingCorrection}
                                        className="text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-0.5 bg-gray-100 text-gray-500 hover:bg-gray-200"
                                      >
                                        <X className="h-2.5 w-2.5" /> Deshacer corrección
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* Nota de corrección pendiente */}
                              {entry.correctionPending && entry.correctionNote && (
                                <div className="mt-1.5 text-[11px] text-orange-700 bg-orange-100 rounded px-2 py-1 italic">
                                  📝 {entry.correctionNote}
                                </div>
                              )}
                              {/* Nota de resolución */}
                              {entry.correctionResolved && entry.correctionResolvedNote && (
                                <div className="mt-1.5 text-[11px] text-blue-700 bg-blue-100 rounded px-2 py-1 italic flex items-start gap-1">
                                  <BadgeCheck className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  {entry.correctionResolvedNote}
                                </div>
                              )}
                              {/* Modal de nota de resolución (inline) */}
                              {resolveEntryId === entry.id && (
                                <div className="mt-2 bg-blue-50 border border-blue-300 rounded-lg p-3 space-y-2">
                                  <p className="text-xs font-semibold text-blue-800">¿En qué semana/pago pusieron el dinero faltante?</p>
                                  <textarea
                                    className="w-full text-xs border border-blue-300 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    rows={2}
                                    placeholder="Ej: Lo pusieron en la semana 18, pago del viernes..."
                                    value={resolveNote}
                                    onChange={e => setResolveNote(e.target.value)}
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => { setResolveEntryId(null); setResolveNote('') }}
                                      className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingCorrection}
                                      onClick={() => saveCorrection(entry.id, false, null, true, resolveNote.trim() || null)}
                                      className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 font-semibold"
                                    >
                                      {savingCorrection ? 'Guardando...' : 'Confirmar corregido'}
                                    </button>
                                  </div>
                                </div>
                              )}
                              {/* Modal de nota de corrección pendiente (inline) */}
                              {correctionEntryId === entry.id && (
                                <div className="mt-2 bg-orange-50 border border-orange-300 rounded-lg p-3 space-y-2">
                                  <p className="text-xs font-semibold text-orange-800">¿Por qué necesita corrección?</p>
                                  <textarea
                                    className="w-full text-xs border border-orange-300 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-orange-400"
                                    rows={2}
                                    placeholder="Ej: El monto recibido no coincide, falta $X..."
                                    value={correctionNote}
                                    onChange={e => setCorrectionNote(e.target.value)}
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => { setCorrectionEntryId(null); setCorrectionNote('') }}
                                      className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingCorrection}
                                      onClick={() => saveCorrection(entry.id, true, correctionNote.trim() || null, false)}
                                      className="text-xs px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-semibold"
                                    >
                                      {savingCorrection ? 'Guardando...' : 'Marcar pendiente'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
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
                          <button
                            type="button"
                            onClick={() => setAddEntryWeekId(null)}
                            className="text-xs px-3 py-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={savingEntry || !addEntryForm.date || (addEntryForm.hours === '' && addEntryForm.minutes === '')}
                            onClick={handleAddEntry}
                            className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold disabled:opacity-50"
                          >
                            {savingEntry ? 'Guardando...' : 'Guardar trabajo'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    {week.totalCompanyPaid > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 bg-emerald-100 border-t border-emerald-200">
                        <span className="text-xs font-bold text-emerald-800">
                          Total empresa ({week.paidEntryCount} trabajo{week.paidEntryCount === 1 ? '' : 's'})
                        </span>
                        <div className="text-right">
                          <span className="text-base font-black text-emerald-700">{formatCurrency(week.totalCompanyPaid)}</span>
                          {week.totalHours > 0 && (
                            <div className="text-[11px] text-emerald-600">
                              ≈ {formatCurrency(week.totalCompanyPaid / week.totalHours)}/h efectivos
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
