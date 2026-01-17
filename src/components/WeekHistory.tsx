'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { Calendar, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EntryList } from './EntryList'

const ITEMS_PER_PAGE = 5

interface Entry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
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
  entries: Entry[]
}

interface WeekHistoryProps {
  readonly onRefresh?: () => void
  readonly refreshTrigger?: number
}

export function WeekHistory({ onRefresh, refreshTrigger = 0 }: Readonly<WeekHistoryProps>) {
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchWeeks = async () => {
    try {
      const res = await fetch('/api/weeks')
      const data = await res.json()
      
      if (data.success) {
        setWeeks(data.data)
      }
    } catch (error) {
      console.error('Error fetching weeks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWeeks()
  }, [refreshTrigger])

  const handleEntryDelete = () => {
    fetchWeeks()
    if (onRefresh) onRefresh()
  }

  // Paginación
  const totalPages = Math.ceil(weeks.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedWeeks = weeks.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de Semanas
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

  if (weeks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de Semanas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No hay semanas registradas
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
          Historial de Semanas
          <span className="text-xs font-normal text-gray-500">({weeks.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="space-y-2">
          {paginatedWeeks.map((week) => (
            <div key={week.id} className="border rounded-lg overflow-hidden">
              <Button
                variant="ghost"
                className="w-full justify-between p-3 sm:p-4 h-auto"
                onClick={() => setExpandedWeek(expandedWeek === week.id ? null : week.id)}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {expandedWeek === week.id ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                  <div className="text-left min-w-0">
                    <div className="font-semibold text-sm sm:text-base truncate">
                      Sem {week.weekNumber} - {getMonthName(week.month)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 flex flex-wrap items-center gap-1">
                      <span className="bg-blue-100 text-blue-700 px-1 sm:px-1.5 py-0.5 rounded font-medium">
                        {new Date(week.startDate).getDate()}
                      </span>
                      <span>→</span>
                      <span className="bg-green-100 text-green-700 px-1 sm:px-1.5 py-0.5 rounded font-medium">
                        {new Date(week.endDate).getDate()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-sm sm:text-base">{week.totalHours.toFixed(1)}h</div>
                  <div className="text-green-600 font-semibold text-sm sm:text-base">
                    {formatCurrency(week.earnings)}
                  </div>
                </div>
              </Button>
              
              {expandedWeek === week.id && week.entries.length > 0 && (
                <div className="p-3 sm:p-4 pt-0 border-t bg-gray-50">
                  <EntryList
                    entries={week.entries}
                    title={`Entradas de la Semana ${week.weekNumber}`}
                    showDate
                    onDelete={handleEntryDelete}
                    onUpdate={() => { fetchWeeks(); onRefresh?.(); }}
                  />
                </div>
              )}
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
