'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDuration, formatCurrency } from '@/lib/utils'
import { Clock, DollarSign, Trash2, Pencil, X, Check } from 'lucide-react'

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
        onUpdate?.()
      }
    } catch (error) {
      console.error('Error updating entry:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (entries.length === 0) {
    return (
      <Card className="border-0 shadow-xl shadow-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No hay trabajos registrados hoy
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
  const totalAmount = entries.reduce((sum, e) => sum + (e.amount || 0), 0)

  return (
    <Card className="border-0 shadow-xl shadow-gray-100">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            {title}
            <span className="text-sm font-normal text-gray-500">
              ({entries.length})
            </span>
          </CardTitle>
          <div className="text-sm text-gray-500">
            {formatDuration(totalDuration)} • {formatCurrency(totalAmount)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
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
                      <div className="font-medium text-gray-900">
                        {new Date(entry.startTime).toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                        {entry.endTime && (
                          <span className="text-gray-400">
                            {' → '}
                            {new Date(entry.endTime).toLocaleTimeString('es-ES', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {entry.duration && formatDuration(entry.duration)}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {editingId !== entry.id && (
                <div className="text-right mr-2">
                  <div className="font-bold text-green-600">
                    {entry.amount && formatCurrency(entry.amount)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {entry.hourlyRate && `${formatCurrency(entry.hourlyRate)}/h`}
                  </div>
                </div>
              )}
              {entry.completed && (
                <div className="flex items-center">
                  {editingId === entry.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSaveEdit(entry)}
                        disabled={isSaving}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={cancelEditing}
                        disabled={isSaving}
                        className="text-gray-400 hover:text-gray-600"
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
                        className="text-gray-400 hover:text-blue-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(entry.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
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
