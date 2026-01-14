'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, getMonthName } from '@/lib/utils'
import { Calendar, Clock, DollarSign, TrendingUp } from 'lucide-react'

interface DaySummary {
  date: string
  totalSeconds: number
  totalHours: number
  earnings: number
}

interface WeekData {
  weekNumber: number
  year: number
  month: number
  startDate: string
  endDate: string
  totalHours: number
  earnings: number
  entries: Array<{
    id: string
    startTime: string
    endTime: string | null
    duration: number | null
    date: string
  }>
}

interface MonthSummaryData {
  year: number
  month: number
  totalHours: number
  earnings: number
}

interface SummaryCardsProps {
  today: DaySummary
  currentWeek: WeekData
  monthSummary: MonthSummaryData
  hourlyRate: number
}

export function SummaryCards({ today, currentWeek, monthSummary, hourlyRate }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Hoy */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hoy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatDuration(today.totalSeconds)}
          </div>
          <div className="text-lg text-green-600 font-semibold">
            {formatCurrency(today.earnings)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(today.date).toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'short'
            })}
          </div>
        </CardContent>
      </Card>

      {/* Semana Actual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Semana {currentWeek.weekNumber}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {currentWeek.totalHours.toFixed(2)}h
          </div>
          <div className="text-lg text-green-600 font-semibold">
            {formatCurrency(currentWeek.earnings)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(currentWeek.startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - {new Date(currentWeek.endDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </div>
        </CardContent>
      </Card>

      {/* Mes Actual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {getMonthName(monthSummary.month)} {monthSummary.year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {monthSummary.totalHours.toFixed(2)}h
          </div>
          <div className="text-lg text-green-600 font-semibold">
            {formatCurrency(monthSummary.earnings)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Total del mes
          </div>
        </CardContent>
      </Card>

      {/* Tarifa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Tarifa por Hora
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            ${hourlyRate}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            USD/hora
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
