'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDuration, getMonthName } from '@/lib/utils'
import { BarChart3, ChevronDown, ChevronRight, ChevronLeft, DollarSign, Trash2, Pencil, X, Check } from 'lucide-react'
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

interface MonthData {
  year: number
  month: number
  entries: PaymentEntry[]
  totalAmount: number
  totalDuration: number
  avgHourlyRate: number
  jobCount: number
}

interface PaymentMonthSummaryProps {
  readonly onRefresh?: () => void
}

export function PaymentMonthSummary({ onRefresh }: Readonly<PaymentMonthSummaryProps>) {
  const [months, setMonths] = useState<MonthData[]>([])
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/payment/dashboard')
      const data = await res.json()
      
      if (data.success && data.data.recentEntries) {
        // Group entries by month
        const entriesByMonth = new Map<string, PaymentEntry[]>()
        
        for (const entry of data.data.recentEntries) {
          const date = new Date(entry.date)
          const year = date.getFullYear()
          const month = date.getMonth() + 1
          const key = `${year}-${month}`
          
          if (!entriesByMonth.has(key)) {
            entriesByMonth.set(key, [])
          }
          entriesByMonth.get(key)!.push(entry)
        }
        
        // Convert to array of month data
        const monthArray: MonthData[] = []
        entriesByMonth.forEach((entries, key) => {
          const [year, month] = key.split('-').map(Number)
          const totalAmount = entries.reduce((sum, e) => sum + (e.amount || 0), 0)
          const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
          const avgHourlyRate = totalDuration > 0 ? totalAmount / (totalDuration / 3600) : 0
          
          monthArray.push({
            year,
            month,
            entries,
            totalAmount,
            totalDuration,
            avgHourlyRate,
            jobCount: entries.length
          })
        })
        
        // Sort by year and month descending
        monthArray.sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year
          return b.month - a.month
        })
        
        setMonths(monthArray)
      }
    } catch (error) {
      console.error('Error fetching payment months:', error)
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
  const totalPages = Math.ceil(months.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedMonths = months.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
            Resumen por Meses
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        </CardContent>
      </Card>
    )
  }

  if (months.length === 0) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
            Resumen por Meses
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
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
          Resumen por Meses
          <span className="text-xs font-normal text-gray-500">({months.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="space-y-2">
          {paginatedMonths.map((monthData) => {
            const monthKey = `${monthData.year}-${monthData.month}`
            return (
              <div key={monthKey} className="border rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  className="w-full justify-between p-3 sm:p-4 h-auto"
                  onClick={() => setExpandedMonth(expandedMonth === monthKey ? null : monthKey)}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    {expandedMonth === monthKey ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                    <div className="text-left min-w-0">
                      <div className="font-semibold text-sm sm:text-base truncate">
                        {getMonthName(monthData.month)} {monthData.year}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500">
                        {monthData.jobCount} trabajos • {(monthData.totalDuration / 3600).toFixed(1)}h
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-green-600 text-sm sm:text-base">
                      {formatCurrency(monthData.totalAmount)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500">
                      {formatCurrency(monthData.avgHourlyRate)}/h
                    </div>
                  </div>
                </Button>
                
                {expandedMonth === monthKey && monthData.entries.length > 0 && (
                  <div className="p-3 sm:p-4 pt-0 border-t bg-gray-50 space-y-2">
                    {monthData.entries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-2 sm:p-3 bg-white rounded-lg">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
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
