'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EntryList } from './EntryList'

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
  onRefresh?: () => void
}

export function WeekHistory({ onRefresh }: WeekHistoryProps) {
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
  }, [])

  const handleEntryDelete = () => {
    fetchWeeks()
    if (onRefresh) onRefresh()
  }

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
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Historial de Semanas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {weeks.map((week) => (
            <div key={week.id} className="border rounded-lg overflow-hidden">
              <Button
                variant="ghost"
                className="w-full justify-between p-4 h-auto"
                onClick={() => setExpandedWeek(expandedWeek === week.id ? null : week.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedWeek === week.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <div className="text-left">
                    <div className="font-semibold">
                      Semana {week.weekNumber} - {getMonthName(week.month)} {week.year}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(week.startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - {new Date(week.endDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{week.totalHours.toFixed(2)}h</div>
                  <div className="text-green-600 font-semibold">
                    {formatCurrency(week.earnings)}
                  </div>
                </div>
              </Button>
              
              {expandedWeek === week.id && week.entries.length > 0 && (
                <div className="p-4 pt-0 border-t bg-gray-50">
                  <EntryList
                    entries={week.entries}
                    title={`Entradas de la Semana ${week.weekNumber}`}
                    showDate
                    onDelete={handleEntryDelete}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
