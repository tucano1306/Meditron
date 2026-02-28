'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { BarChart3, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

const ITEMS_PER_PAGE = 5

interface TimeEntry {
  id: string
  duration: number | null
  companyPaid: number | null
  calculatedAmount: number | null
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

            return (
              <div key={week.id} className="p-2.5 bg-gray-50 rounded-lg space-y-2">
                {/* Header: Fecha y horas */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span className="font-medium text-sm">
                      {formatDateRange(week.startDate, week.endDate)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Sem {week.weekNumber}
                    </span>
                  </div>
                  <span className="font-bold text-sm text-gray-700">
                    {week.totalHours.toFixed(1)}h
                  </span>
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
