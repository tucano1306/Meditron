'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDuration, getMonthName, getWeekNumber, toFloridaDate, formatTimeInFlorida, formatShortDateFlorida, formatLongDateFlorida, getFloridaDateComponents } from '@/lib/utils'
import { Calendar, ChevronDown, ChevronRight, ChevronLeft, DollarSign, Trash2, Pencil, X, Check, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

const ITEMS_PER_PAGE = 5

interface PaymentEntry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  amount: number | null
  hourlyRate: number | null
  date: string
  completed: boolean
}

interface WeekData {
  weekNumber: number
  year: number
  month: number
  entries: PaymentEntry[]
  totalAmount: number
  totalDuration: number
  avgHourlyRate: number
}

interface PaymentWeekHistoryProps {
  readonly onRefresh?: () => void
}

export function PaymentWeekHistory({ onRefresh }: Readonly<PaymentWeekHistoryProps>) {
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchData = async () => {
    try {
      // Get entries from the last 60 days
      const res = await fetch('/api/payment/dashboard')
      const data = await res.json()
      
      if (data.success && data.data.recentEntries) {
        // Group entries by week usando zona horaria de Florida
        const entriesByWeek = new Map<string, PaymentEntry[]>()
        
        for (const entry of data.data.recentEntries) {
          // Convertir a zona horaria de Florida para calcular la semana correcta
          const floridaDate = toFloridaDate(new Date(entry.date))
          const weekNum = getWeekNumber(floridaDate)
          const year = floridaDate.getFullYear()
          const key = `${year}-${weekNum}`
          
          if (!entriesByWeek.has(key)) {
            entriesByWeek.set(key, [])
          }
          entriesByWeek.get(key)!.push(entry)
        }
        
        // Convert to array of week data
        const weekArray: WeekData[] = []
        entriesByWeek.forEach((entries, key) => {
          const [year, weekNum] = key.split('-').map(Number)
          const totalAmount = entries.reduce((sum, e) => sum + (e.amount || 0), 0)
          const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
          const avgHourlyRate = totalDuration > 0 ? totalAmount / (totalDuration / 3600) : 0
          
          // Usar zona horaria de Florida para obtener el mes correcto
          const floridaDateFirst = toFloridaDate(new Date(entries[0].date))
          
          weekArray.push({
            weekNumber: weekNum,
            year,
            month: floridaDateFirst.getMonth() + 1,
            entries,
            totalAmount,
            totalDuration,
            avgHourlyRate
          })
        })
        
        // Sort by year and week descending
        weekArray.sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year
          return b.weekNumber - a.weekNumber
        })
        
        setWeeks(weekArray)
      }
    } catch (error) {
      console.error('Error fetching payment weeks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este trabajo?')) return
    
    try {
      const res = await fetch(`/api/payment?id=${id}`, { method: 'DELETE' })
      const result = await res.json()
      
      if (result.success) {
        fetchData()
        onRefresh?.()
      }
    } catch (error) {
      console.error('Error deleting entry:', error)
    }
  }

  const startEditing = (entry: PaymentEntry) => {
    // Usar zona horaria de Florida para obtener la hora correcta
    const startComponents = getFloridaDateComponents(new Date(entry.startTime))
    const endComponents = entry.endTime ? getFloridaDateComponents(new Date(entry.endTime)) : null
    
    setEditStartTime(`${String(startComponents.hour).padStart(2, '0')}:${String(startComponents.minute).padStart(2, '0')}`)
    setEditEndTime(endComponents ? `${String(endComponents.hour).padStart(2, '0')}:${String(endComponents.minute).padStart(2, '0')}` : '')
    setEditAmount(entry.amount?.toString() || '')
    setEditingId(entry.id)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditStartTime('')
    setEditEndTime('')
    setEditAmount('')
  }

  const handleSaveEdit = async (entry: PaymentEntry) => {
    if (!editStartTime || !editEndTime || !editAmount) return
    
    setIsSaving(true)
    try {
      const entryDate = new Date(entry.date)
      const [startH, startM] = editStartTime.split(':').map(Number)
      const [endH, endM] = editEndTime.split(':').map(Number)
      
      const newStart = new Date(entryDate)
      newStart.setHours(startH, startM, 0, 0)
      
      const newEnd = new Date(entryDate)
      newEnd.setHours(endH, endM, 0, 0)
      
      if (newEnd <= newStart) {
        newEnd.setDate(newEnd.getDate() + 1)
      }
      
      const res = await fetch(`/api/payment?id=${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          amount: Number(editAmount)
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        cancelEditing()
        fetchData()
        onRefresh?.()
      }
    } catch (error) {
      console.error('Error updating entry:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Paginación
  const totalPages = Math.ceil(weeks.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedWeeks = weeks.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Historial de Pagos por Semana - Meditron</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #333; }
          h1 { color: #2563eb; font-size: 24px; margin-bottom: 8px; }
          .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
          .week { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px; page-break-inside: avoid; }
          .week-header { background: linear-gradient(to right, #eff6ff, #dbeafe); padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
          .week-title { font-weight: 600; font-size: 16px; color: #1e40af; }
          .week-info { font-size: 12px; color: #6b7280; margin-top: 4px; }
          .week-summary { display: flex; justify-content: space-between; padding: 12px 16px; background: #f9fafb; }
          .summary-item { text-align: center; }
          .summary-label { font-size: 11px; color: #6b7280; }
          .summary-value { font-size: 18px; font-weight: 700; color: #059669; }
          .summary-value.blue { color: #2563eb; }
          .entries { padding: 12px 16px; }
          .entry { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .entry:last-child { border-bottom: none; }
          .entry-date { font-size: 13px; color: #374151; font-weight: 500; }
          .entry-time { font-size: 12px; color: #6b7280; }
          .entry-amount { font-size: 16px; font-weight: 700; color: #059669; }
          .entry-rate { font-size: 12px; color: #6b7280; }
          .total-section { margin-top: 24px; padding: 16px; background: linear-gradient(to right, #2563eb, #4f46e5); color: white; border-radius: 8px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .total-label { font-size: 14px; opacity: 0.9; }
          .total-value { font-size: 20px; font-weight: 700; }
          @media print { body { padding: 0; } .week { break-inside: avoid; } }
        </style>
      </head>
      <body>
        <h1>💰 Historial de Pagos por Semana</h1>
        <p class="subtitle">Control de Pagos - Meditron | Generado: ${formatLongDateFlorida(new Date())}</p>
        
        ${weeks.map(week => `
          <div class="week">
            <div class="week-header">
              <div class="week-title">📅 Semana ${week.weekNumber} - ${getMonthName(week.month)} ${week.year}</div>
              <div class="week-info">${week.entries.length} trabajos • ${formatDuration(week.totalDuration)}</div>
            </div>
            <div class="week-summary">
              <div class="summary-item">
                <div class="summary-label">Total</div>
                <div class="summary-value">${formatCurrency(week.totalAmount)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Duración</div>
                <div class="summary-value blue">${formatDuration(week.totalDuration)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Tarifa Prom.</div>
                <div class="summary-value">${formatCurrency(week.avgHourlyRate)}/h</div>
              </div>
            </div>
            <div class="entries">
              ${week.entries.map(entry => `
                <div class="entry">
                  <div>
                    <div class="entry-date">
                      ${formatShortDateFlorida(entry.date)}
                    </div>
                    <div class="entry-time">
                      ${formatTimeInFlorida(entry.startTime)}
                      ${entry.endTime ? `→ ${formatTimeInFlorida(entry.endTime)}` : ''}
                      ${entry.duration ? ` • ${formatDuration(entry.duration)}` : ''}
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div class="entry-amount">${entry.amount ? formatCurrency(entry.amount) : '-'}</div>
                    <div class="entry-rate">${entry.hourlyRate ? `${formatCurrency(entry.hourlyRate)}/h` : ''}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
        
        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Total Ganado:</span>
            <span class="total-value">${formatCurrency(weeks.reduce((sum, w) => sum + w.totalAmount, 0))}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Total Tiempo:</span>
            <span class="total-value">${formatDuration(weeks.reduce((sum, w) => sum + w.totalDuration, 0))}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Total Trabajos:</span>
            <span class="total-value">${weeks.reduce((sum, w) => sum + w.entries.length, 0)}</span>
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Historial por Semanas
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        </CardContent>
      </Card>
    )
  }

  if (weeks.length === 0) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Historial por Semanas
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="text-center text-gray-500 py-8">No hay trabajos registrados</div>
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
            Historial por Semanas
            <span className="text-xs font-normal text-gray-500">({weeks.length})</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="space-y-2">
          {paginatedWeeks.map((week) => {
            const weekKey = `${week.year}-${week.weekNumber}`
            return (
              <div key={weekKey} className="border rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  className="w-full justify-between p-3 sm:p-4 h-auto"
                  onClick={() => setExpandedWeek(expandedWeek === weekKey ? null : weekKey)}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    {expandedWeek === weekKey ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                    <div className="text-left min-w-0">
                      <div className="font-semibold text-sm sm:text-base truncate">
                        Sem {week.weekNumber} - {getMonthName(week.month)}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500">
                        {week.entries.length} trabajos • {formatDuration(week.totalDuration)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-green-600 text-sm sm:text-base">
                      {formatCurrency(week.totalAmount)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500">
                      {formatCurrency(week.avgHourlyRate)}/h
                    </div>
                  </div>
                </Button>
                
                {expandedWeek === weekKey && week.entries.length > 0 && (
                  <div className="p-3 sm:p-4 pt-0 border-t bg-gray-50 space-y-2">
                    {week.entries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            {editingId === entry.id ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="time"
                                    value={editStartTime}
                                    onChange={(e) => setEditStartTime(e.target.value)}
                                    className="px-2 py-1 text-sm border rounded w-24"
                                  />
                                  <span className="text-gray-400">→</span>
                                  <input
                                    type="time"
                                    value={editEndTime}
                                    onChange={(e) => setEditEndTime(e.target.value)}
                                    className="px-2 py-1 text-sm border rounded w-24"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-500">$</span>
                                  <input
                                    type="number"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="px-2 py-1 text-sm border rounded w-24"
                                    step="0.01"
                                    min="0"
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="text-sm font-medium">
                                  {formatShortDateFlorida(entry.date)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatTimeInFlorida(entry.startTime)}
                                  {entry.endTime && ` → ${formatTimeInFlorida(entry.endTime)}`}
                                  {entry.duration && ` • ${formatDuration(entry.duration)}`}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        {editingId !== entry.id && (
                          <div className="text-right mr-2">
                            <div className="font-bold text-green-600 text-sm">
                              {entry.amount && formatCurrency(entry.amount)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {entry.hourlyRate && `${formatCurrency(entry.hourlyRate)}/h`}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center">
                          {editingId === entry.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSaveEdit(entry)}
                                disabled={isSaving}
                                className="text-green-600 hover:text-green-700 h-8 w-8"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={cancelEditing}
                                disabled={isSaving}
                                className="text-gray-400 hover:text-gray-600 h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEditing(entry)}
                                className="text-gray-400 hover:text-blue-600 h-8 w-8"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(entry.id)}
                                className="text-gray-400 hover:text-red-600 h-8 w-8"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
