'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDuration, getMonthName, getWeekNumber, toFloridaDate } from '@/lib/utils'
import { Calendar, ChevronDown, ChevronRight, ChevronLeft, DollarSign, Trash2, Pencil, X, Check } from 'lucide-react'
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
          
          weekArray.push({
            weekNumber: weekNum,
            year,
            month: new Date(entries[0].date).getMonth() + 1,
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
    const start = new Date(entry.startTime)
    const end = entry.endTime ? new Date(entry.endTime) : null
    
    setEditStartTime(start.toTimeString().slice(0, 5))
    setEditEndTime(end ? end.toTimeString().slice(0, 5) : '')
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
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
          Historial por Semanas
          <span className="text-xs font-normal text-gray-500">({weeks.length})</span>
        </CardTitle>
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
                                  {new Date(entry.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(entry.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                  {entry.endTime && ` → ${new Date(entry.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
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
