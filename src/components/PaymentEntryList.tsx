'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDuration, formatCurrency, formatTimeInFlorida, getFloridaDateComponents } from '@/lib/utils'
import { Clock, DollarSign, Trash2, Pencil, X, Check, Bus } from 'lucide-react'

interface PaymentEntry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  amount: number | null
  hourlyRate: number | null
  jobNumber?: string | null
  vehicle?: string | null
  date: string
  completed: boolean
}

interface PaymentEntryListProps {
  readonly entries: PaymentEntry[]
  readonly title?: string
  readonly onDelete?: () => void
  readonly onUpdate?: () => void
}

export function PaymentEntryList({ 
  entries, 
  title = 'Trabajos de Hoy',
  onDelete,
  onUpdate
}: Readonly<PaymentEntryListProps>) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este trabajo?')) return
    
    try {
      const res = await fetch(`/api/payment?id=${id}`, { method: 'DELETE' })
      const result = await res.json()
      
      if (result.success) {
        onDelete?.()
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
        onUpdate?.()
      }
    } catch (error) {
      console.error('Error updating entry:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const vehicleLabels: Record<string, string> = {
    'sprinter': 'Sprinter',
    'mini-bus': 'Mini Bus',
    'motorcoach': 'Motorcoach'
  }

  const getVehicleLabel = (value: string | null) => {
    if (!value) return null
    return vehicleLabels[value] || value
  }

  if (entries.length === 0) {
    return (
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Clock className="h-4 w-4 text-white" />
            </div>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="text-center py-8 text-gray-500 text-sm sm:text-base">
            No hay trabajos registrados hoy
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
  const totalAmount = entries.reduce((sum, e) => sum + (e.amount || 0), 0)

  return (
    <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-2 px-3 sm:px-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <span>{title}</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
              {entries.length}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-full">
              {formatDuration(totalDuration)}
            </span>
            <span className="text-gray-400">•</span>
            <span className="font-bold text-emerald-600">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pt-4">
        <div className="space-y-2 sm:space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === entry.id ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                          className="px-2 py-1 text-sm border rounded w-20 sm:w-24"
                        />
                        <span className="text-gray-400">→</span>
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                          className="px-2 py-1 text-sm border rounded w-20 sm:w-24"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">$</span>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="px-2 py-1 text-sm border rounded w-20 sm:w-24"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="font-medium text-gray-900 text-sm sm:text-base px-2 py-1 bg-white rounded-lg shadow-sm border border-gray-100 inline-block">
                        {formatTimeInFlorida(entry.startTime)}
                        {entry.endTime && (
                          <span className="text-gray-400 mx-1">→</span>
                        )}
                        {entry.endTime ? (
                          <span className="text-gray-700">
                            {formatTimeInFlorida(entry.endTime)}
                          </span>
                        ) : (
                          <span className="text-amber-500 animate-pulse ml-1">En curso...</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-sm sm:text-base font-mono font-bold text-gray-700">
                          {entry.duration ? formatDuration(entry.duration) : <span className="text-amber-500 animate-pulse">⏱️</span>}
                        </div>
                        {entry.jobNumber && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                            #{entry.jobNumber}
                          </span>
                        )}
                        {entry.vehicle && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full flex items-center gap-1">
                            <Bus className="h-3 w-3" />
                            {getVehicleLabel(entry.vehicle)}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Amount - always show */}
              {editingId !== entry.id && (
                <div className="text-right mr-0.5 sm:mr-2 flex-shrink-0">
                  {entry.completed ? (
                    <>
                      <div className="font-black text-emerald-600 text-sm sm:text-lg">
                        {entry.amount ? formatCurrency(entry.amount) : '-'}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500 font-medium">
                        {entry.hourlyRate ? `${formatCurrency(entry.hourlyRate)}/h` : ''}
                      </div>
                    </>
                  ) : (
                    <div className="px-2 py-1 sm:px-3 sm:py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-full animate-pulse text-xs sm:text-sm shadow-md">
                      ⏱️ En curso
                    </div>
                  )}
                </div>
              )}
              
              {/* Action buttons - always show for completed entries */}
              {entry.completed && (
                <div className="flex items-center flex-shrink-0">
                  {editingId === entry.id ? (
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSaveEdit(entry)}
                        disabled={isSaving}
                        className="text-green-600 hover:text-green-700 h-7 w-7 sm:h-8 sm:w-8"
                      >
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={cancelEditing}
                        disabled={isSaving}
                        className="text-gray-400 hover:text-gray-600 h-7 w-7 sm:h-8 sm:w-8"
                      >
                        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditing(entry)}
                        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 h-7 w-7 sm:h-8 sm:w-8"
                      >
                        <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(entry.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 sm:h-8 sm:w-8"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
