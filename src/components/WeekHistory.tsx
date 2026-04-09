'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDuration, getMonthName, parseLocalDate, formatTimeInFlorida, formatShortDateFlorida, formatLongDateFlorida } from '@/lib/utils'
import { Calendar, ChevronDown, ChevronRight, ChevronLeft, Printer, TrendingUp, Clock, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EntryList } from './EntryList'

const ITEMS_PER_PAGE = 5

interface Entry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
  jobNumber?: string | null
  vehicle?: string | null
  calculatedAmount?: number | null
  paidAmount?: number | null
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

// ─── Resumen de trabajos por semana ──────────────────────────────────────────
function WeekJobSummary({ entries, hourlyRate }: Readonly<{ entries: Entry[]; hourlyRate: number }>) {
  const completedEntries = entries.filter(e => e.duration !== null && e.endTime !== null)

  if (completedEntries.length === 0) return null

  const totalSeconds = completedEntries.reduce((s, e) => s + (e.duration ?? 0), 0)
  const totalHours = totalSeconds / 3600
  const calculatedTotal = totalHours * hourlyRate

  const entriesWithPay = completedEntries.filter(e => e.paidAmount != null && e.paidAmount > 0)
  const totalPaid = entriesWithPay.reduce((s, e) => s + (e.paidAmount ?? 0), 0)
  const paidHours = entriesWithPay.reduce((s, e) => s + (e.duration ?? 0), 0) / 3600
  const effectiveRate = paidHours > 0 ? totalPaid / paidHours : null

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 overflow-hidden">
      <div className="px-3 py-2 bg-emerald-600 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-white" />
        <span className="text-white text-sm font-bold">Resumen de trabajos</span>
      </div>

      <div className="grid grid-cols-3 gap-0 divide-x divide-emerald-200 border-b border-emerald-200">
        <div className="flex flex-col items-center py-2.5 px-1">
          <Clock className="h-3.5 w-3.5 text-emerald-600 mb-0.5" />
          <span className="text-[11px] text-gray-500">Horas</span>
          <span className="text-base font-black text-gray-800">{totalHours.toFixed(2)}h</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600 mb-0.5" />
          <span className="text-[11px] text-gray-500">Calculado</span>
          <span className="text-base font-black text-emerald-600">{formatCurrency(calculatedTotal)}</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <TrendingUp className="h-3.5 w-3.5 text-blue-500 mb-0.5" />
          <span className="text-[11px] text-gray-500">Tarifa real</span>
          <span className="text-base font-black text-blue-600">
            {effectiveRate == null ? '—' : `${formatCurrency(effectiveRate)}/h`}
          </span>
        </div>
      </div>

      <div className="divide-y divide-emerald-100">
        {completedEntries.map((entry) => {
          const hours = (entry.duration ?? 0) / 3600
          const calc = hours * hourlyRate
          const paid = entry.paidAmount ?? null
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
                <span className="text-xs text-gray-400">calc: {formatCurrency(calc)}</span>
                {paid == null ? (
                  <span className="text-xs text-gray-400 italic">sin pago</span>
                ) : (
                  <>
                    <span className="text-sm font-bold text-gray-800">pagado: {formatCurrency(paid)}</span>
                    <span className={`text-[11px] font-semibold ${(diff ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {(diff ?? 0) >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(diff ?? 0))}
                    </span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {entriesWithPay.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-emerald-100 border-t border-emerald-200">
          <span className="text-xs font-bold text-emerald-800">
            Total pagado ({entriesWithPay.length} trabajo{entriesWithPay.length === 1 ? '' : 's'})
          </span>
          <div className="text-right">
            <span className="text-base font-black text-emerald-700">{formatCurrency(totalPaid)}</span>
            {effectiveRate != null && (
              <div className="text-[11px] text-emerald-600">≈ {formatCurrency(effectiveRate)}/h efectivos</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function WeekHistory({ onRefresh, refreshTrigger = 0 }: Readonly<WeekHistoryProps>) {
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [hourlyRate, setHourlyRate] = useState<number>(25)

  const fetchWeeks = async () => {
    try {
      const [weeksRes, dashboardRes] = await Promise.all([
        fetch('/api/weeks'),
        fetch('/api/dashboard')
      ])
      const weeksData = await weeksRes.json()
      const dashboardData = await dashboardRes.json()
      
      if (weeksData.success) {
        setWeeks(weeksData.data)
      }
      if (dashboardData.success) {
        setHourlyRate(dashboardData.data.hourlyRate || 25)
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

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Historial de Semanas - Meditron</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #333; }
          h1 { color: #059669; font-size: 24px; margin-bottom: 8px; }
          .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
          .week { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px; page-break-inside: avoid; }
          .week-header { background: linear-gradient(to right, #ecfdf5, #d1fae5); padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
          .week-title { font-weight: 600; font-size: 16px; color: #065f46; }
          .week-dates { font-size: 12px; color: #6b7280; margin-top: 4px; }
          .week-summary { display: flex; justify-content: space-between; padding: 12px 16px; background: #f9fafb; }
          .summary-item { text-align: center; }
          .summary-label { font-size: 11px; color: #6b7280; }
          .summary-value { font-size: 18px; font-weight: 700; color: #059669; }
          .entries { padding: 12px 16px; }
          .entry { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .entry:last-child { border-bottom: none; }
          .entry-date { font-size: 13px; color: #374151; }
          .entry-time { font-size: 12px; color: #6b7280; }
          .entry-duration { font-size: 14px; font-weight: 600; color: #1f2937; }
          .entry-earnings { font-size: 14px; font-weight: 600; color: #059669; }
          .job-badge { background: linear-gradient(to right, #3b82f6, #4f46e5); color: white; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; }
          .total-section { margin-top: 24px; padding: 16px; background: linear-gradient(to right, #059669, #10b981); color: white; border-radius: 8px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .total-label { font-size: 14px; opacity: 0.9; }
          .total-value { font-size: 20px; font-weight: 700; }
          @media print { body { padding: 0; } .week { break-inside: avoid; } }
        </style>
      </head>
      <body>
        <h1>📊 Historial de Semanas</h1>
        <p class="subtitle">Control de Horas - Meditron | Generado: ${formatLongDateFlorida(new Date())}</p>
        
        ${weeks.map(week => `
          <div class="week">
            <div class="week-header">
              <div class="week-title">📅 Semana ${week.weekNumber} - ${getMonthName(week.month)} ${week.year}</div>
              <div class="week-dates">Lun ${parseLocalDate(week.startDate).getDate()} → Dom ${parseLocalDate(week.endDate).getDate()}</div>
            </div>
            <div class="week-summary">
              <div class="summary-item">
                <div class="summary-label">Horas</div>
                <div class="summary-value">${week.totalHours.toFixed(1)}h</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Ganancias</div>
                <div class="summary-value">${formatCurrency(week.earnings)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Entradas</div>
                <div class="summary-value">${week.entries.length}</div>
              </div>
            </div>
            <div class="entries">
              ${week.entries.map(entry => `
                <div class="entry">
                  <div>
                    <div class="entry-date">
                      ${formatShortDateFlorida(entry.date)}
                      ${entry.jobNumber ? `<span class="job-badge">#${entry.jobNumber}</span>` : ''}
                    </div>
                    <div class="entry-time">
                      ${formatTimeInFlorida(entry.startTime)}
                      → ${entry.endTime ? formatTimeInFlorida(entry.endTime) : 'En curso'}
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div class="entry-duration">${entry.duration ? formatDuration(entry.duration) : '-'}</div>
                    <div class="entry-earnings">${entry.duration ? formatCurrency((entry.duration / 3600) * hourlyRate) : '-'}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
        
        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Total Horas:</span>
            <span class="total-value">${weeks.reduce((sum, w) => sum + w.totalHours, 0).toFixed(1)}h</span>
          </div>
          <div class="total-row">
            <span class="total-label">Total Ganancias:</span>
            <span class="total-value">${formatCurrency(weeks.reduce((sum, w) => sum + w.earnings, 0))}</span>
          </div>
        </div>
      </body>
      </html>
    `

    printWindow.document.documentElement.innerHTML = content
    setTimeout(() => {
      printWindow.print()
    }, 250)
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Historial de Semanas
            <span className="text-xs font-normal text-gray-500">({weeks.length})</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 touch-manipulation"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
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
                        {parseLocalDate(week.startDate).getDate()}
                      </span>
                      <span>→</span>
                      <span className="bg-green-100 text-green-700 px-1 sm:px-1.5 py-0.5 rounded font-medium">
                        {parseLocalDate(week.endDate).getDate()}
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
                  <WeekJobSummary entries={week.entries} hourlyRate={hourlyRate} />
                  <div className="mt-3">
                    <EntryList
                      entries={week.entries}
                      title={`Entradas de la Semana ${week.weekNumber}`}
                      showDate
                      onDelete={handleEntryDelete}
                      onUpdate={() => { fetchWeeks(); onRefresh?.(); }}
                      hourlyRate={hourlyRate}
                    />
                  </div>
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
              className="flex items-center gap-1 touch-manipulation"
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
              className="flex items-center gap-1 touch-manipulation"
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
