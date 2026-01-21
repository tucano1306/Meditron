'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Calendar, TrendingUp, TrendingDown, DollarSign, Clock, Briefcase, AlertCircle } from 'lucide-react'

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
}

export function WeeklySummary() {
  const [weeklyData, setWeeklyData] = useState<WeeklySummaryData[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
            
            // Parsear fechas como fecha local (formato YYYY-MM-DD)
            const parseLocalDate = (dateStr: string) => {
              const [year, month, day] = dateStr.split('-').map(Number)
              return new Date(year, month - 1, day)
            }
            
            return (
              <div key={`${week.year}-${week.weekNumber}`} className="border rounded-lg p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      Semana {week.weekNumber} - {week.year}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {parseLocalDate(week.startDate).toLocaleDateString('es-ES', { 
                        month: 'short', 
                        day: 'numeric' 
                      })} - {parseLocalDate(week.endDate).toLocaleDateString('es-ES', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
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
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Trabajos */}
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                    <Briefcase className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Trabajos</p>
                      <p className="font-semibold text-sm">{week.totalJobs}</p>
                    </div>
                  </div>

                  {/* Horas */}
                  <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Horas</p>
                      <p className="font-semibold text-sm">{week.totalHours.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Monto Calculado */}
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Calculado</p>
                      <p className="font-semibold text-sm">{formatCurrency(week.calculatedAmount)}</p>
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
                    <div className={`flex justify-between items-center pt-2 border-t`}>
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
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
