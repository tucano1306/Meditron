'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { BarChart3, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

const ITEMS_PER_PAGE = 5

interface MonthData {
  id: string
  year: number
  month: number
  totalHours: number
  earnings: number
}

interface MonthSummaryProps {
  readonly refreshTrigger?: number
}

export function MonthSummary({ refreshTrigger = 0 }: Readonly<MonthSummaryProps>) {
  const [months, setMonths] = useState<MonthData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    async function fetchMonths() {
      try {
        const res = await fetch('/api/months')
        const data = await res.json()
        
        if (data.success) {
          setMonths(data.data)
        }
      } catch (error) {
        console.error('Error fetching months:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchMonths()
  }, [refreshTrigger])

  // Paginación
  const totalPages = Math.ceil(months.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedMonths = months.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumen Mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Cargando...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (months.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumen Mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No hay datos mensuales
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calcular el máximo para las barras de progreso
  const maxHours = Math.max(...months.map(m => m.totalHours), 1)

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
          Resumen Mensual
          <span className="text-xs font-normal text-gray-500">({months.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="space-y-4">
          {paginatedMonths.map((month) => (
            <div key={month.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base truncate">
                    {getMonthName(month.month)} {month.year}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="font-semibold text-sm sm:text-base">{month.totalHours.toFixed(1)}h</span>
                  <span className="text-green-600 ml-1 sm:ml-2 font-semibold text-sm sm:text-base">
                    {formatCurrency(month.earnings)}
                  </span>
                </div>
              </div>
              <Progress value={(month.totalHours / maxHours) * 100} />
            </div>
          ))}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="text-sm text-gray-500">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
