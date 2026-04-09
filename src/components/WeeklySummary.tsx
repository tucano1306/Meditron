'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDateInFlorida, formatDuration, formatShortDateFlorida } from '@/lib/utils'
import { Calendar, TrendingUp, TrendingDown, DollarSign, Clock, Briefcase, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'

interface PaymentEntryRow {
  id: string
  date: string
  jobNumber: string | null
  vehicle: string | null
  duration: number | null
  amount: number | null
  hourlyRate: number | null
  companyPaid: number | null
}

interface WeeklySummaryData {
  weekNumber: number
  year: number
  startDate: string
  endDate: string
  totalJobs: number
  totalHours: number
  calculatedAmount: number
  companyPaidAmount: number
  difference: number
  differencePercentage: number
  entries: PaymentEntryRow[]
}

export function WeeklySummary() {
  const [weeklyData, setWeeklyData] = useState<WeeklySummaryData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)

  const toggleWeek = (key: string) => {
    setExpandedWeek(prev => (prev === key ? null : key))
  }

  const fetchData = async () => {
    try {
      const res = await fetch('/api/payment/weekly-summary')
      const data = await res.json()
      
      if (data.success) {
        setWeeklyData(data.data)
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
            const weekKey = `${week.year}-${week.weekNumber}`
            const isExpanded = expandedWeek === weekKey
            
            return (
              <div key={weekKey} className="border rounded-lg overflow-hidden">
                {/* Header expandible */}
                <button
                  type="button"
                  className="w-full p-4 space-y-3 text-left"
                  onClick={() => toggleWeek(weekKey)}
                >
                  {/* Title row */}
                  <div className="flex items-center justify-between border-b pb-2">
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">
                        Semana {week.weekNumber} - {week.year}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {formatDateInFlorida(week.startDate, { 
                          month: 'short', 
                          day: 'numeric' 
                        })} - {formatDateInFlorida(week.endDate, { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasDifference && (
                        <div className={`flex items-center gap-1 ${differenceClass}`}>
                          {week.difference >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span className="font-semibold text-sm">
                            {week.differencePercentage.toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
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
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          Pagado por Compañía:
                        </span>
                        <span className="font-semibold text-sm">
                          {formatCurrency(week.companyPaidAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-xs sm:text-sm font-medium">
                          Diferencia:
                        </span>
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

                {/* Panel expandido: detalle por trabajo */}
                {isExpanded && week.entries.length > 0 && (
                  <div className="border-t border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 overflow-hidden">
                    <div className="px-3 py-2 bg-emerald-600 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-white" />
                      <span className="text-white text-sm font-bold">Detalle de trabajos</span>
                    </div>
                    <div className="divide-y divide-emerald-100">
                      {week.entries.map((entry) => {
                        const calc = entry.amount ?? 0
                        const paid = entry.companyPaid ?? null
                        const diff = paid == null ? null : paid - calc
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
                              <span className="text-xs text-gray-400">facturado: {formatCurrency(calc)}</span>
                              {paid == null ? (
                                <span className="text-xs text-gray-400 italic">sin pago compañía</span>
                              ) : (
                                <>
                                  <span className="text-sm font-bold text-gray-800">compañía: {formatCurrency(paid)}</span>
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
                    {hasDifference && (
                      <div className="flex items-center justify-between px-3 py-2 bg-emerald-100 border-t border-emerald-200">
                        <span className="text-xs font-bold text-emerald-800">
                          Total ({week.totalJobs} trabajo{week.totalJobs === 1 ? '' : 's'})
                        </span>
                        <div className="text-right">
                          <span className="text-base font-black text-emerald-700">{formatCurrency(week.companyPaidAmount)}</span>
                          <div className="text-[11px] text-emerald-600">
                            ≈ {(week.companyPaidAmount / (week.totalHours || 1)).toFixed(2)}/h efectivos
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
