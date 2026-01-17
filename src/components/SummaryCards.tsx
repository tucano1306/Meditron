'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDuration, formatCurrency, getMonthName, parseLocalDate } from '@/lib/utils'
import { Calendar, Clock, DollarSign, TrendingUp, Pencil, Check, X } from 'lucide-react'

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
  readonly today: DaySummary
  readonly currentWeek: WeekData
  readonly monthSummary: MonthSummaryData
  readonly hourlyRate: number
  readonly onRateChange?: (newRate: number) => void
}

export function SummaryCards({ today, currentWeek, monthSummary, hourlyRate, onRateChange }: Readonly<SummaryCardsProps>) {
  const [isEditingRate, setIsEditingRate] = useState(false)
  const [tempRate, setTempRate] = useState(hourlyRate.toString())
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveRate = async () => {
    const newRate = Number.parseFloat(tempRate)
    if (Number.isNaN(newRate) || newRate <= 0) {
      return
    }
    
    setIsSaving(true)
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hourlyRate: newRate })
      })
      const data = await res.json()
      
      if (data.success) {
        setIsEditingRate(false)
        onRateChange?.(newRate)
      }
    } catch (err) {
      console.error('Error saving rate:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Hoy */}
      <Card className="border-0 shadow-lg shadow-emerald-50 bg-gradient-to-br from-white to-emerald-50/30">
        <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-1 sm:gap-2">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500" />
            Hoy
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold text-gray-900">
            {formatDuration(today.totalSeconds)}
          </div>
          <div className="text-sm sm:text-lg text-emerald-600 font-semibold">
            {formatCurrency(today.earnings)}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400 mt-1 hidden sm:block">
            {new Date(today.date).toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'short'
            })}
          </div>
        </CardContent>
      </Card>

      {/* Semana Actual */}
      <Card className="border-0 shadow-lg shadow-blue-50 bg-gradient-to-br from-white to-blue-50/30">
        <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-1 sm:gap-2">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
            <span className="hidden sm:inline">Semana</span> {currentWeek.weekNumber}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold text-gray-900">
            {currentWeek.totalHours.toFixed(2)}h
          </div>
          <div className="text-sm sm:text-lg text-blue-600 font-semibold">
            {formatCurrency(currentWeek.earnings)}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400 mt-1 hidden sm:block">
            <span className="text-blue-600 font-medium">lun {parseLocalDate(currentWeek.startDate).getDate()}</span>
            {' - '}
            <span className="text-green-600 font-medium">dom {parseLocalDate(currentWeek.endDate).getDate()}</span>
            {' '}{getMonthName(parseLocalDate(currentWeek.startDate).getMonth() + 1)}
          </div>
        </CardContent>
      </Card>

      {/* Mes Actual */}
      <Card className="border-0 shadow-lg shadow-purple-50 bg-gradient-to-br from-white to-purple-50/30">
        <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-1 sm:gap-2">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
            <span className="truncate">{getMonthName(monthSummary.month)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-lg sm:text-2xl font-bold text-gray-900">
            {monthSummary.totalHours.toFixed(2)}h
          </div>
          <div className="text-sm sm:text-lg text-purple-600 font-semibold">
            {formatCurrency(monthSummary.earnings)}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400 mt-1 hidden sm:block">
            Total del mes
          </div>
        </CardContent>
      </Card>

      {/* Tarifa - Editable */}
      <Card className="border-0 shadow-lg shadow-orange-50 bg-gradient-to-br from-white to-orange-50/30">
        <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-1 sm:gap-2">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
            <span className="hidden sm:inline">Tarifa</span>
            {!isEditingRate && (
              <button
                onClick={() => {
                  setTempRate(hourlyRate.toString())
                  setIsEditingRate(true)
                }}
                className="ml-auto text-gray-400 hover:text-orange-500 transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {isEditingRate ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-orange-600 font-bold">$</span>
                <input
                  type="number"
                  value={tempRate}
                  onChange={(e) => setTempRate(e.target.value)}
                  className="w-16 sm:w-20 px-2 py-1 text-lg font-bold text-orange-600 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                  step="0.01"
                  min="0"
                  autoFocus
                />
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  onClick={handleSaveRate}
                  disabled={isSaving}
                  className="flex-1 h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditingRate(false)
                    setTempRate(hourlyRate.toString())
                  }}
                  className="flex-1 h-7 text-xs text-gray-500 hover:bg-gray-100"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-lg sm:text-2xl font-bold text-orange-600">
                ${hourlyRate}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500 mt-1">
                USD/hr
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
