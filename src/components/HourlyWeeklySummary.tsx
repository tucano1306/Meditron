'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDateInFlorida, formatDuration, formatShortDateFlorida } from '@/lib/utils'
import { Calendar, TrendingUp, TrendingDown, DollarSign, Clock, Briefcase, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { EntryDetailModal, type ModalEntry } from '@/components/EntryDetailModal'

interface HourlyEntry {
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

interface HourlyWeeklySummaryData {
  weekNumber: number
  year: number
  startDate: string
  endDate: string
  totalJobs: number
  reviewedJobs: number
  totalHours: number
  calculatedAmount: number
  companyPaidAmount: number
  difference: number
  differencePercentage: number
  entries: HourlyEntry[]
}

export function HourlyWeeklySummary() {
  const [weeklyData, setWeeklyData] = useState<HourlyWeeklySummaryData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hourlyRate, setHourlyRate] = useState(25)
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<ModalEntry | null>(null)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/entries/weekly-summary')
      const data = await res.json()
      
      if (data.success) {
        setWeeklyData(data.data)
        if (typeof data.hourlyRate === 'number') setHourlyRate(data.hourlyRate)
      }
    } catch (error) {
      console.error('Error fetching weekly summary:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const toggleWeek = (key: string) => {
    setExpandedWeek(prev => (prev === key ? null : key))
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Resumen Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    )
  }

  if (weeklyData.length === 0) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Resumen Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Resumen Semanal - Comparación de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="space-y-4">
            {weeklyData.map((week) => {
              const hasDifference = week.companyPaidAmount > 0
              const differenceClass = week.difference >= 0 ? 'text-green-600' : 'text-red-600'
              const allReviewed = week.totalJobs > 0 && week.reviewedJobs === week.totalJobs
              const weekKey = `${week.year}-${week.weekNumber}`
              const isExpanded = expandedWeek === weekKey
              
              return (
                <div key={weekKey} className={`border rounded-lg overflow-hidden transition-all duration-300 ${allReviewed ? 'border-green-400' : ''}`}>
                  {/* Header — clickable to expand */}
                  <button
                    type="button"
                    className={`w-full p-4 space-y-3 text-left transition-colors ${allReviewed ? 'bg-green-50/30 hover:bg-green-50/60' : 'hover:bg-gray-50/60'}`}
                    onClick={() => toggleWeek(weekKey)}
                  >
                    {/* Title row */}
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm sm:text-base">
                            Semana {week.weekNumber} - {week.year}
                          </h3>
                          {allReviewed && (
                            <span className="relative inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg overflow-hidden">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              REVISADO
                              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {formatDateInFlorida(week.startDate, { month: 'short', day: 'numeric' })} -{' '}
                          {formatDateInFlorida(week.endDate, { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasDifference && (
                          <div className={`flex items-center gap-1 ${differenceClass}`}>
                            {week.difference >= 0
                              ? <TrendingUp className="h-4 w-4" />
                              : <TrendingDown className="h-4 w-4" />}
                            <span className="font-semibold text-sm">
                              {week.differencePercentage.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 sm:gap-2 p-2 bg-blue-50 rounded">
                        <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Trabajos</p>
                          <p className="font-semibold text-xs sm:text-sm">{week.totalJobs}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 p-2 bg-purple-50 rounded">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Horas</p>
                          <p className="font-semibold text-xs sm:text-sm">{week.totalHours.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 p-2 bg-green-50 rounded">
                        <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Calculado</p>
                          <p className="font-semibold text-xs sm:text-sm">{formatCurrency(week.calculatedAmount)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Payment Comparison */}
                    {hasDifference ? (
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs sm:text-sm text-muted-foreground">Pagado por Compañía:</span>
                          <span className="font-semibold text-sm">{formatCurrency(week.companyPaidAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-xs sm:text-sm font-medium">Diferencia:</span>
                          <span className={`font-bold text-sm ${differenceClass}`}>
                            {week.difference >= 0 ? '+' : ''}{formatCurrency(week.difference)}
                          </span>
                        </div>
                        {week.difference < 0 && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 pt-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>La compañía pagó menos de lo calculado</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-xs text-blue-700">
                          Los pagos de compañía se comparan automáticamente cuando los registres en cada trabajo
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Expanded entries */}
                  {isExpanded && week.entries.length > 0 && (
                    <div className="border-t border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
                      <div className="px-3 py-2 bg-purple-600 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-white" />
                        <span className="text-white text-sm font-bold">Detalle de entradas</span>
                        <span className="ml-auto text-purple-200 text-xs">Toca para ver detalles</span>
                      </div>
                      <div className="divide-y divide-purple-100">
                        {week.entries.map((entry) => {
                          const calc = entry.calculatedAmount ?? ((entry.duration ?? 0) / 3600) * hourlyRate
                          const paid = entry.companyPaid ?? null
                          const diff = paid == null ? null : paid - calc
                          const hasPending = !!(entry.correctionPending && !entry.correctionResolved)
                          const hasResolved = !!entry.correctionResolved

                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => setSelectedEntry(entry)}
                              className="w-full flex items-center justify-between px-3 py-2.5 gap-2 hover:bg-purple-100/60 active:bg-purple-100 transition-colors text-left"
                            >
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
                                  {entry.serviceType && (
                                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded">
                                      {entry.serviceType === 'point-to-point' ? 'P2P' : 'Hourly'}
                                    </span>
                                  )}
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">
                                    {formatDuration(entry.duration ?? 0)}
                                  </span>
                                  {hasPending && (
                                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold rounded">
                                      ⚠ PENDIENTE
                                    </span>
                                  )}
                                  {hasResolved && (
                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded">
                                      ✓ CORREGIDO
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end flex-shrink-0 text-right">
                                <span className="text-xs text-gray-500">{formatCurrency(calc)}</span>
                                {paid == null ? (
                                  <span className="text-xs text-gray-400 italic">sin pago</span>
                                ) : (
                                  <>
                                    <span className="text-sm font-bold text-gray-800">{formatCurrency(paid)}</span>
                                    {diff != null && (
                                      <span className={`text-[11px] font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {diff >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(diff))}
                                      </span>
                                    )}
                                  </>
                                )}
                                <ChevronRight className="h-3 w-3 text-gray-300 mt-0.5" />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      {/* Footer total */}
                      <div className="flex items-center justify-between px-3 py-2 bg-purple-100 border-t border-purple-200">
                        <span className="text-xs font-bold text-purple-800">
                          Total ({week.totalJobs} trabajo{week.totalJobs === 1 ? '' : 's'})
                        </span>
                        <div className="text-right">
                          <span className="text-base font-black text-purple-700">{formatCurrency(week.calculatedAmount)}</span>
                          {hasDifference && (
                            <div className="text-[11px] text-purple-600">
                              empresa: {formatCurrency(week.companyPaidAmount)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Entry detail modal */}
      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          hourlyRate={hourlyRate}
          onClose={() => setSelectedEntry(null)}
          onUpdate={() => {
            setSelectedEntry(null)
            fetchData()
          }}
        />
      )}
    </>
  )
}

