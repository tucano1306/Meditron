'use client'

import { useState } from 'react'
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Hoy */}
      <div className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white px-4 py-4 shadow-sm active:scale-[0.97] transition-transform touch-manipulation select-none">
        <div className="flex items-center gap-1.5 text-[#787774] mb-3">
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <Clock className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <span className="text-[12px] font-medium uppercase tracking-wide">Hoy</span>
        </div>
        <div className="text-[22px] sm:text-[26px] font-bold text-[#37352f] leading-tight">
          {formatDuration(today.totalSeconds)}
        </div>
        <div className="text-[15px] font-semibold text-emerald-600 mt-1">
          {formatCurrency(today.earnings)}
        </div>
        <div className="text-[11px] text-[#787774] mt-1.5 hidden sm:block">
          {formatDateInFlorida(today.date, {
            weekday: 'long',
            day: 'numeric',
            month: 'short'
          })}
        </div>
      </div>

      {/* Semana Actual */}
      <div className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white px-4 py-4 shadow-sm active:scale-[0.97] transition-transform touch-manipulation select-none">
        <div className="flex items-center gap-1.5 text-[#787774] mb-3">
          <div className="p-1.5 bg-emerald-50 rounded-lg">
            <Calendar className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <span className="text-[12px] font-medium uppercase tracking-wide">Semana</span>
          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] rounded-md font-mono font-bold">{currentWeek.weekNumber}</span>
        </div>
        <div className="text-[22px] sm:text-[26px] font-bold text-[#37352f] leading-tight">
          {currentWeek.totalHours.toFixed(2)}h
        </div>
        <div className="text-[15px] font-semibold text-emerald-600 mt-1">
          {formatCurrency(currentWeek.earnings)}
        </div>
        <div className="text-[11px] text-[#787774] mt-1.5 hidden sm:block">
          lun {parseLocalDate(currentWeek.startDate).getDate()} → dom {parseLocalDate(currentWeek.endDate).getDate()} {getMonthName(parseLocalDate(currentWeek.startDate).getMonth() + 1)}
        </div>
      </div>

      {/* Mes Actual */}
      <div className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white px-4 py-4 shadow-sm active:scale-[0.97] transition-transform touch-manipulation select-none">
        <div className="flex items-center gap-1.5 text-[#787774] mb-3">
          <div className="p-1.5 bg-purple-50 rounded-lg">
            <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <span className="text-[12px] font-medium uppercase tracking-wide truncate">{getMonthName(monthSummary.month)}</span>
        </div>
        <div className="text-[22px] sm:text-[26px] font-bold text-[#37352f] leading-tight">
          {monthSummary.totalHours.toFixed(2)}h
        </div>
        <div className="text-[15px] font-semibold text-emerald-600 mt-1">
          {formatCurrency(monthSummary.earnings)}
        </div>
        <div className="text-[11px] text-[#787774] mt-1.5 hidden sm:block">Total del mes</div>
      </div>

      {/* Tarifa - Editable */}
      <div className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-[#787774] mb-3">
          <div className="p-1.5 bg-amber-50 rounded-lg">
            <DollarSign className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <span className="text-[12px] font-medium uppercase tracking-wide">Tarifa</span>
          {!isEditingRate && (
            <button
              type="button"
              onClick={() => {
                setTempRate(hourlyRate.toString())
                setIsEditingRate(true)
              }}
              className="ml-auto p-1 text-[#787774] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] rounded-[3px] transition-colors touch-manipulation"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
        {isEditingRate ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-[13px] text-[#787774]">$</span>
              <input
                type="number"
                value={tempRate}
                onChange={(e) => setTempRate(e.target.value)}
                className="w-full max-w-[70px] px-2 py-1 text-[14px] font-semibold text-[#37352f] border border-[rgba(55,53,47,0.16)] rounded-[4px] focus:outline-none focus:border-[#37352f]"
                style={{ fontSize: '16px' }}
                step="0.01"
                min="0"
                autoFocus
              />
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleSaveRate}
                disabled={isSaving}
                className="flex-1 py-1 text-[12px] bg-[#37352f] text-white rounded-[4px] hover:bg-[#2f2d28] disabled:opacity-60 transition-colors flex items-center justify-center touch-manipulation"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingRate(false)
                  setTempRate(hourlyRate.toString())
                }}
                className="flex-1 py-1 text-[12px] text-[#787774] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] rounded-[4px] transition-colors flex items-center justify-center touch-manipulation"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-[22px] sm:text-[26px] font-bold text-[#37352f] leading-tight">
              ${hourlyRate}
            </div>
            <div className="text-[11px] text-[#787774] mt-0.5">USD/hr</div>
          </>
        )}
      </div>
    </div>
  )
}
