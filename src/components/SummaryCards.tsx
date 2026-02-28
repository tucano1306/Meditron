'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDuration, formatCurrency, getMonthName, parseLocalDate, formatDateInFlorida } from '@/lib/utils'
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
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden hover:shadow-2xl transition-all duration-300">
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-green-500"></div>
        <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-1 sm:gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
            </div>
            <span className="font-semibold">Hoy</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-xl sm:text-3xl font-black text-gray-900">
            {formatDuration(today.totalSeconds)}
          </div>
          <div className="text-base sm:text-xl text-emerald-600 font-bold">
            {formatCurrency(today.earnings)}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400 mt-1 hidden sm:block">
            {formatDateInFlorida(today.date, {
              weekday: 'long',
              day: 'numeric',
              month: 'short'
            })}
          </div>
        </CardContent>
      </Card>

      {/* Semana Actual */}
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden hover:shadow-2xl transition-all duration-300">
        <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
        <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-1 sm:gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
            </div>
            <span className="font-semibold hidden sm:inline">Semana</span> 
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{currentWeek.weekNumber}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-xl sm:text-3xl font-black text-gray-900">
            {currentWeek.totalHours.toFixed(2)}h
          </div>
          <div className="text-base sm:text-xl text-blue-600 font-bold">
            {formatCurrency(currentWeek.earnings)}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400 mt-1 hidden sm:block">
            <span className="text-blue-600 font-medium">lun {parseLocalDate(currentWeek.startDate).getDate()}</span>
            {' → '}
            <span className="text-green-600 font-medium">dom {parseLocalDate(currentWeek.endDate).getDate()}</span>
            {' '}{getMonthName(parseLocalDate(currentWeek.startDate).getMonth() + 1)}
          </div>
        </CardContent>
      </Card>

      {/* Mes Actual */}
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden hover:shadow-2xl transition-all duration-300">
        <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-500"></div>
        <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-1 sm:gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-md">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
            </div>
            <span className="font-semibold truncate">{getMonthName(monthSummary.month)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-xl sm:text-3xl font-black text-gray-900">
            {monthSummary.totalHours.toFixed(2)}h
          </div>
          <div className="text-base sm:text-xl text-purple-600 font-bold">
            {formatCurrency(monthSummary.earnings)}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400 mt-1 hidden sm:block">
            Total del mes
          </div>
        </CardContent>
      </Card>

      {/* Tarifa - Editable */}
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden hover:shadow-2xl transition-all duration-300">
        <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-500"></div>
        <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-1 sm:gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
            </div>
            <span className="font-semibold hidden sm:inline">Tarifa</span>
            {!isEditingRate && (
              <button
                onClick={() => {
                  setTempRate(hourlyRate.toString())
                  setIsEditingRate(true)
                }}
                className="ml-auto p-1.5 text-gray-400 hover:text-orange-500 transition-colors hover:bg-orange-50 rounded-lg touch-manipulation"
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
                <span className="text-orange-600 font-black text-lg flex-shrink-0">$</span>
                <input
                  type="number"
                  value={tempRate}
                  onChange={(e) => setTempRate(e.target.value)}
                  className="w-full max-w-[80px] px-2 py-1 text-lg sm:text-xl font-black text-orange-600 border-2 border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50"
                  style={{ fontSize: '16px' }}
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
                  className="flex-1 h-8 text-xs bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl touch-manipulation active:scale-[0.96]"
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
                  className="flex-1 h-8 text-xs text-gray-500 hover:bg-gray-100 rounded-xl touch-manipulation"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-xl sm:text-3xl font-black text-orange-600">
                ${hourlyRate}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500 mt-1 font-medium">
                USD/hr
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
