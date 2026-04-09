'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatShortDateFlorida, formatDuration } from '@/lib/utils'
import { BarChart3, Calendar, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, TrendingUp, DollarSign, Clock } from 'lucide-react'
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

  const toggleWeek = (id: string) => setExpandedWeek(prev => (prev === id ? null : id))

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
            const difference = week.totalCompanyPaid - week.earnings
            const hasPayments = week.paidEntryCount > 0
            const allPaid = week.paidEntryCount === week.entryCount && week.entryCount > 0

            const isExpanded = expandedWeek === week.id
            const completedEntries = week.entries.filter(e => e.duration !== null)

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
                    {allPaid ? (
                      <span className="relative inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow overflow-hidden">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        REVISADO
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
                        SIN REVISAR
                      </span>
                    )}
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
                    <div className="font-bold text-blue-600">{formatCurrency(week.earnings)}</div>
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
                {isExpanded && completedEntries.length > 0 && (
                  <div className="border-t border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 overflow-hidden">
                    <div className="px-3 py-2 bg-emerald-600 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-white" />
                      <span className="text-white text-sm font-bold">Detalle de trabajos</span>
                    </div>

                    {/* Métricas resumen */}
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
                          {formatCurrency(completedEntries.reduce((s, e) => s + (e.calculatedAmount ?? 0), 0))}
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

                    {/* Lista de entradas */}
                    <div className="divide-y divide-emerald-100">
                      {completedEntries.map((entry) => {
                        const calc = entry.calculatedAmount ?? 0
                        const paid = entry.paidAmount ?? null
                        const companyPaid = entry.companyPaid ?? null
                        const diff = companyPaid == null ? null : companyPaid - calc
                        return (
                          <div key={entry.id} className="flex items-center justify-between px-3 py-2 gap-2">
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
                              </div>
                            </div>
                            <div className="flex flex-col items-end flex-shrink-0 text-right">
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
                            </div>
                          </div>
                        )
                      })}
                    </div>

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
