'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, HOURLY_RATE } from '@/lib/utils'
import { Clock, Trash2, Pencil, X, Check, ChevronDown, ChevronRight, Eye, FileText, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Entry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
  jobNumber?: string | null
  calculatedAmount?: number | null
  paidAmount?: number | null
}

interface EntryListProps {
  readonly entries: Entry[]
  readonly title?: string
  readonly onDelete?: () => void
  readonly onUpdate?: () => void
  readonly showDate?: boolean
  readonly hourlyRate?: number
}

export function EntryList({ entries, title = "Entradas de Hoy", onDelete, onUpdate, showDate = false, hourlyRate = HOURLY_RATE }: Readonly<EntryListProps>) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editDate, setEditDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Estado para el modal de información del trabajo
  const [jobModalEntryId, setJobModalEntryId] = useState<string | null>(null)
  const [jobNumber, setJobNumber] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [isSavingJob, setIsSavingJob] = useState(false)

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada?')) return
    
    try {
      const res = await fetch(`/api/entries?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      
      if (data.success && onDelete) {
        onDelete()
      }
    } catch (error) {
      console.error('Error deleting entry:', error)
    }
  }

  const startEditing = (entry: Entry) => {
    const start = new Date(entry.startTime)
    const end = entry.endTime ? new Date(entry.endTime) : null
    
    // Obtener fecha en formato YYYY-MM-DD
    const dateStr = typeof entry.date === 'string' ? entry.date.split('T')[0] : new Date(entry.date).toISOString().split('T')[0]
    
    setEditStartTime(start.toTimeString().slice(0, 5))
    setEditEndTime(end ? end.toTimeString().slice(0, 5) : '')
    setEditDate(dateStr)
    setEditingId(entry.id)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditStartTime('')
    setEditEndTime('')
    setEditDate('')
  }

  // Funciones para el modal del trabajo
  const openJobModal = (entry: Entry) => {
    setJobModalEntryId(entry.id)
    setJobNumber(entry.jobNumber || '')
    setPaidAmount(entry.paidAmount?.toString() || '')
  }

  const closeJobModal = () => {
    setJobModalEntryId(null)
    setJobNumber('')
    setPaidAmount('')
  }

  const getCalculatedAmount = (entry: Entry) => {
    if (!entry.duration) return 0
    return (entry.duration / 3600) * hourlyRate
  }

  const handleSaveJobInfo = async (entry: Entry) => {
    setIsSavingJob(true)
    try {
      const calculatedAmount = getCalculatedAmount(entry)
      const res = await fetch(`/api/entries?id=${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobNumber,
          calculatedAmount,
          paidAmount: paidAmount ? Number.parseFloat(paidAmount) : null,
          startTime: entry.startTime,
          endTime: entry.endTime
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        closeJobModal()
        onUpdate?.()
      } else {
        alert(data.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('Error saving job info:', error)
      alert('Error al guardar información del trabajo')
    } finally {
      setIsSavingJob(false)
    }
  }

  const handleSaveEdit = async (entry: Entry) => {
    if (!editStartTime || !editEndTime || !editDate) return
    
    setIsSaving(true)
    try {
      // Usar la fecha editada por el usuario
      const [year, month, day] = editDate.split('-').map(Number)
      const entryDate = new Date(year, month - 1, day)
      
      const [startH, startM] = editStartTime.split(':').map(Number)
      const [endH, endM] = editEndTime.split(':').map(Number)
      
      const newStart = new Date(entryDate)
      newStart.setHours(startH, startM, 0, 0)
      
      const newEnd = new Date(entryDate)
      newEnd.setHours(endH, endM, 0, 0)
      
      // Si el fin es antes que el inicio, asumir día siguiente
      if (newEnd <= newStart) {
        newEnd.setDate(newEnd.getDate() + 1)
      }
      
      const res = await fetch(`/api/entries?id=${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString()
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        cancelEditing()
        onUpdate?.()
      } else {
        alert(data.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('Error updating entry:', error)
      alert('Error al actualizar la entrada')
    } finally {
      setIsSaving(false)
    }
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No hay entradas registradas
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0)

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer sm:cursor-default select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {/* Icono de expandir solo en móvil */}
            <span className="sm:hidden">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              )}
            </span>
            <Clock className="h-5 w-5" />
            {title}
            <span className="text-sm font-normal text-gray-500">
              ({entries.length})
            </span>
          </CardTitle>
          
          {/* Botón Ver solo en laptop/desktop */}
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="hidden sm:flex items-center gap-1"
          >
            <Eye className="h-4 w-4" />
            {isExpanded ? 'Ocultar' : 'Ver'}
          </Button>
        </div>
        
        {/* Resumen cuando está colapsado */}
        {!isExpanded && (
          <div className="text-sm text-gray-500 mt-1">
            {formatDuration(totalDuration)} total • {formatCurrency((totalDuration / 3600) * hourlyRate)}
          </div>
        )}
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="px-2 sm:px-6">
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg gap-2"
            >
              <div className="flex-1 min-w-0">
                {showDate && (
                  <div className="text-xs text-gray-500 mb-1">
                    {(() => {
                      // Parsear la fecha evitando problemas de zona horaria
                      const dateStr = typeof entry.date === 'string' ? entry.date.split('T')[0] : new Date(entry.date).toISOString().split('T')[0]
                      const [year, month, day] = dateStr.split('-').map(Number)
                      const localDate = new Date(year, month - 1, day)
                      return localDate.toLocaleDateString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                      })
                    })()}
                  </div>
                )}
                {editingId === entry.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="px-2 py-1 text-sm border rounded w-full sm:w-36"
                    />
                    <div className="flex items-center gap-1 sm:gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{2}:[0-9]{2}"
                        placeholder="HH:MM"
                        value={editStartTime}
                        onChange={(e) => {
                          let val = e.target.value.replaceAll(/[^0-9:]/g, '')
                          if (val.length === 2 && !val.includes(':')) val += ':'
                          if (val.length <= 5) setEditStartTime(val)
                        }}
                        className="px-1 sm:px-2 py-1 text-xs sm:text-sm border rounded w-14 sm:w-20 text-center"
                      />
                      <span className="text-gray-400 text-xs">-</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{2}:[0-9]{2}"
                        placeholder="HH:MM"
                        value={editEndTime}
                        onChange={(e) => {
                          let val = e.target.value.replaceAll(/[^0-9:]/g, '')
                          if (val.length === 2 && !val.includes(':')) val += ':'
                          if (val.length <= 5) setEditEndTime(val)
                        }}
                        className="px-1 sm:px-2 py-1 text-xs sm:text-sm border rounded w-14 sm:w-20 text-center"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className="text-xs sm:text-sm text-gray-600">
                      {new Date(entry.startTime).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {' - '}
                      {entry.endTime
                        ? new Date(entry.endTime).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'En progreso...'}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <div className="text-right">
                  {entry.duration === null ? (
                    <div className="text-yellow-600 font-semibold animate-pulse text-sm">
                      En curso...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0">
                      <div className="font-mono font-semibold text-sm sm:text-base">
                        {formatDuration(entry.duration)}
                      </div>
                      <div className="text-xs sm:text-sm text-green-600 font-semibold">
                        {formatCurrency((entry.duration / 3600) * hourlyRate)}
                      </div>
                      {/* Mostrar info del trabajo si existe */}
                      {entry.jobNumber && (
                        <div className="flex flex-col items-end gap-0.5 mt-1 pt-1 border-t border-gray-200">
                          <span className="text-xs text-gray-500">
                            #{entry.jobNumber}
                          </span>
                          {entry.paidAmount !== null && entry.paidAmount !== undefined && (
                            <div className="flex items-center gap-1">
                              {(() => {
                                const calculated = (entry.duration / 3600) * hourlyRate
                                const diff = entry.paidAmount - calculated
                                const isPositive = diff >= 0
                                return (
                                  <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {isPositive ? '😊' : '😢'} {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                                  </span>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {entry.endTime && (
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
                          onClick={() => openJobModal(entry)}
                          className={`h-8 w-8 ${entry.jobNumber ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-purple-600'}`}
                          title="Información del trabajo"
                        >
                          <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditing(entry)}
                          className="text-gray-400 hover:text-blue-600 h-8 w-8"
                        >
                          <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(entry.id)}
                          className="text-gray-400 hover:text-red-600 h-8 w-8"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        </CardContent>
      )}
      
      {/* Modal de información del trabajo */}
      {jobModalEntryId && (() => {
        const modalEntry = entries.find(e => e.id === jobModalEntryId)
        if (!modalEntry) return null
        
        const calculatedAmount = getCalculatedAmount(modalEntry)
        const paid = paidAmount ? Number.parseFloat(paidAmount) : 0
        const difference = paid - calculatedAmount
        const isPositive = difference >= 0
        
        return (
          <>
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              aria-hidden="true"
            />
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto pointer-events-auto">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 id="job-modal-title" className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Información del Trabajo
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeJobModal}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Resumen de la entrada */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="text-sm text-gray-500 mb-1">Tiempo trabajado</div>
                  <div className="font-mono font-semibold">
                    {modalEntry.duration ? formatDuration(modalEntry.duration) : '--:--:--'}
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Número de trabajo */}
                  <div>
                    <label htmlFor="jobNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Trabajo
                    </label>
                    <input
                      id="jobNumber"
                      type="text"
                      value={jobNumber}
                      onChange={(e) => setJobNumber(e.target.value)}
                      placeholder="Ej: 12345"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Monto calculado (automático) */}
                  <div>
                    <div className="block text-sm font-medium text-gray-700 mb-1">
                      Monto Calculado (automático)
                    </div>
                    <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg font-semibold text-green-600">
                      {formatCurrency(calculatedAmount)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Basado en {modalEntry.duration ? (modalEntry.duration / 3600).toFixed(2) : 0} hrs × {formatCurrency(hourlyRate)}/hr
                    </p>
                  </div>
                  
                  {/* Monto pagado */}
                  <div>
                    <label htmlFor="paidAmount" className="block text-sm font-medium text-gray-700 mb-1">
                      Monto Pagado por la Compañía
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        id="paidAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  {/* Diferencia */}
                  {paidAmount && (
                    <div className={`p-4 rounded-lg ${isPositive ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-600">Diferencia</div>
                          <div className={`text-xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                          </div>
                        </div>
                        <div className="text-4xl">
                          {isPositive ? '😊' : '😢'}
                        </div>
                      </div>
                      <p className={`text-xs mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive 
                          ? `¡Genial! Te pagaron ${formatCurrency(difference)} más de lo calculado.`
                          : `Te faltaron ${formatCurrency(Math.abs(difference))} por pagar.`
                        }
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Botones */}
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={closeJobModal}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => handleSaveJobInfo(modalEntry)}
                    disabled={isSavingJob}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSavingJob ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </div>
              </div>
            </div>
          </>
        )
      })()}
    </Card>
  )
}
