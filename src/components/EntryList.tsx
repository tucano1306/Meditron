'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, HOURLY_RATE, formatTimeInFlorida, formatShortDateFlorida, getFloridaDateComponents } from '@/lib/utils'
import { Clock, Trash2, Pencil, X, Check, ChevronDown, ChevronRight, Eye, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Entry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
  jobNumber?: string | null
  vehicle?: string | null
  observation?: string | null
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
  const [isExpanded, setIsExpanded] = useState(showDate)
  
  // Estado para el modal de información del trabajo
  const [jobModalEntryId, setJobModalEntryId] = useState<string | null>(null)
  const [jobNumber, setJobNumber] = useState('')
  const [vehicleModal, setVehicleModal] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [observation, setObservation] = useState('')
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
    // Usar zona horaria de Florida para obtener la hora correcta
    const startComponents = getFloridaDateComponents(new Date(entry.startTime))
    const endComponents = entry.endTime ? getFloridaDateComponents(new Date(entry.endTime)) : null
    
    // Obtener fecha en formato YYYY-MM-DD
    const dateStr = typeof entry.date === 'string' ? entry.date.split('T')[0] : new Date(entry.date).toISOString().split('T')[0]
    
    setEditStartTime(`${String(startComponents.hour).padStart(2, '0')}:${String(startComponents.minute).padStart(2, '0')}`)
    setEditEndTime(endComponents ? `${String(endComponents.hour).padStart(2, '0')}:${String(endComponents.minute).padStart(2, '0')}` : '')
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
    setVehicleModal(entry.vehicle || '')
    setPaidAmount(entry.paidAmount?.toString() || '')
    setObservation(entry.observation || '')
  }

  const closeJobModal = () => {
    setJobModalEntryId(null)
    setJobNumber('')
    setVehicleModal('')
    setPaidAmount('')
    setObservation('')
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
          vehicle: vehicleModal || null,
          observation: observation || null,
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
    <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden">
      <CardHeader 
        className="cursor-pointer sm:cursor-default select-none bg-gradient-to-r from-emerald-50/50 to-green-50/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            {/* Icono de expandir solo en móvil */}
            <span className="sm:hidden">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-emerald-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-emerald-500" />
              )}
            </span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <span>{title}</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
              {entries.length}
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
            className="hidden sm:flex items-center gap-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
          >
            <Eye className="h-4 w-4" />
            {isExpanded ? 'Ocultar' : 'Ver'}
          </Button>
        </div>
        
        {/* Resumen cuando está colapsado */}
        {!isExpanded && (
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
            <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold rounded-full">
              {formatDuration(totalDuration)}
            </span>
            <span className="text-gray-400">•</span>
            <span className="font-semibold text-emerald-600">
              {formatCurrency((totalDuration / 3600) * hourlyRate)}
            </span>
          </div>
        )}
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="px-2 sm:px-6 pt-4">
        <div className="space-y-3">
          {entries.map((entry) => (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div
              key={entry.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 gap-2 ${entry.endTime && entry.duration !== null && editingId !== entry.id ? 'cursor-pointer active:scale-[0.99]' : ''}`}
              onClick={() => {
                if (entry.endTime && entry.duration !== null && editingId !== entry.id) {
                  openJobModal(entry)
                }
              }}
            >
              <div className="flex-1 min-w-0">
                {showDate && (
                  <div className="text-xs text-gray-500 mb-1">
                    {formatShortDateFlorida(entry.date)}
                  </div>
                )}
                {editingId === entry.id ? (
                  // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                  <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="px-2 py-1.5 text-sm border rounded w-full sm:w-36"
                      style={{ fontSize: '16px' }}
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
                        className="px-1 sm:px-2 py-1.5 text-sm border rounded w-[72px] sm:w-20 text-center"
                        style={{ fontSize: '16px' }}
                      />
                      <span className="text-gray-400 text-xs flex-shrink-0">-</span>
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
                        className="px-1 sm:px-2 py-1.5 text-sm border rounded w-[72px] sm:w-20 text-center"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className="text-xs sm:text-sm font-medium text-gray-700 px-2 py-1 bg-white rounded-lg shadow-sm border border-gray-100">
                      {formatTimeInFlorida(entry.startTime)}
                      <span className="text-gray-400 mx-1">→</span>
                      {entry.endTime
                        ? formatTimeInFlorida(entry.endTime)
                        : <span className="text-amber-500 animate-pulse">En progreso...</span>}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-2">
                <div className="text-right flex-1 min-w-0">
                  {entry.duration === null || entry.endTime === null ? (
                    <div className="px-2 py-1 sm:px-3 sm:py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-full animate-pulse text-xs sm:text-sm shadow-md inline-block">
                      ⏱️ En curso
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="font-mono font-bold text-sm sm:text-lg text-gray-800 bg-white px-1.5 sm:px-2 py-0.5 rounded-lg shadow-sm">
                        {formatDuration(entry.duration)}
                      </div>
                      <div className="text-sm sm:text-base text-emerald-600 font-black">
                        {formatCurrency((entry.duration / 3600) * hourlyRate)}
                      </div>
                      {/* Mostrar info del trabajo si existe */}
                      {(entry.jobNumber || entry.vehicle) && (
                        <div className="flex items-center gap-1 mt-1 pt-1 border-t border-gray-200 flex-wrap">
                          {entry.jobNumber && (
                            <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] sm:text-sm font-bold rounded-lg shadow-sm truncate max-w-[70px] sm:max-w-none">
                              #{entry.jobNumber}
                            </span>
                          )}
                          {entry.vehicle && (
                            <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 bg-gradient-to-r from-slate-500 to-gray-600 text-white text-[10px] sm:text-sm font-bold rounded-lg shadow-sm">
                              🚗 {entry.vehicle}
                            </span>
                          )}
                          {entry.paidAmount !== null && entry.paidAmount !== undefined && (
                            <div className="flex items-center gap-1">
                              {(() => {
                                const calculated = (entry.duration / 3600) * hourlyRate
                                const diff = entry.paidAmount - calculated
                                const isPositive = diff >= 0
                                return (
                                  <span className={`text-[10px] sm:text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
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
                {/* Action buttons - only show when entry is completed */}
                {entry.endTime && entry.duration !== null && (
                  <div className="flex items-center flex-shrink-0 ml-1">
                    {editingId === entry.id ? (
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSaveEdit(entry)}
                          disabled={isSaving}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 w-7 sm:h-8 sm:w-8"
                        >
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={cancelEditing}
                          disabled={isSaving}
                          className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 h-7 w-7 sm:h-8 sm:w-8"
                        >
                          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    ) : (
                      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
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
            </div>
          ))}
        </div>
        </CardContent>
      )}
      
      {/* Modal de información del trabajo */}
      {/* Modal de Detalles del Trabajo */}
      {jobModalEntryId && (() => {
        const modalEntry = entries.find(e => e.id === jobModalEntryId)
        if (!modalEntry) return null
        
        const calculatedAmount = getCalculatedAmount(modalEntry)
        const paid = paidAmount ? Number.parseFloat(paidAmount) : 0
        const difference = paid - calculatedAmount
        const isPositive = difference >= 0
        
        return (
          // Fullscreen overlay con flexbox para centrar
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div 
            className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
            onClick={closeJobModal}
          >
            {/* Modal box - max height con scroll interno */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div 
              className="bg-white w-full max-w-sm rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header fijo */}
              <div className="bg-emerald-500 px-4 py-3 rounded-t-2xl flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-white" />
                    <span className="text-white font-bold">Detalles del Trabajo</span>
                  </div>
                  <button
                    type="button"
                    onClick={closeJobModal}
                    className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
              
              {/* Contenido scrolleable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Tiempo trabajado */}
                <div className="text-center py-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500">Tiempo: </span>
                  <span className="font-bold text-gray-900">{modalEntry.duration ? formatDuration(modalEntry.duration) : '--:--'}</span>
                </div>

                {/* Job Number */}
                <div>
                  <label htmlFor="modal-job-number" className="text-xs font-bold text-gray-500 uppercase">Job #</label>
                  <input
                    id="modal-job-number"
                    type="text"
                    inputMode="numeric"
                    value={jobNumber}
                    onChange={(e) => setJobNumber(e.target.value)}
                    placeholder="123456"
                    className="mt-1 w-full px-3 py-2 bg-gray-100 rounded-lg text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                {/* Vehículo */}
                <div>
                  <label htmlFor="modal-vehicle" className="text-xs font-bold text-gray-500 uppercase">Vehículo</label>
                  <select
                    id="modal-vehicle"
                    value={vehicleModal}
                    onChange={(e) => setVehicleModal(e.target.value)}
                    className="mt-1 w-full px-3 py-2 bg-gray-100 rounded-lg text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    style={{ fontSize: '16px' }}
                  >
                    <option value="">Sin vehículo</option>
                    <option value="sprinter">Sprinter</option>
                    <option value="mini-bus">Mini Bus</option>
                    <option value="motorcoach">Motorcoach</option>
                  </select>
                </div>

                {/* Calculado */}
                <div className="flex justify-between items-center py-2 px-3 bg-emerald-50 rounded-lg">
                  <span className="text-xs font-bold text-emerald-700 uppercase">Calculado</span>
                  <span className="text-lg font-black text-emerald-600">{formatCurrency(calculatedAmount)}</span>
                </div>

                {/* Pagado */}
                <div>
                  <label htmlFor="modal-paid" className="text-xs font-bold text-gray-500 uppercase">Pagado por Compañía</label>
                  <div className="mt-1 flex items-center bg-gray-100 rounded-lg px-3">
                    <span className="text-gray-400 font-bold">$</span>
                    <input
                      id="modal-paid"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 py-2 bg-transparent text-right font-bold text-gray-900 focus:outline-none"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </div>
                
                {/* Diferencia */}
                {paidAmount && Number.parseFloat(paidAmount) > 0 && (
                  <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
                    <span className={`text-xs font-bold uppercase ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                      {isPositive ? 'Ganancia' : 'Pérdida'}
                    </span>
                    <span className={`text-lg font-black ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                    </span>
                  </div>
                )}

                {/* Nota */}
                <div>
                  <label htmlFor="modal-observation" className="text-xs font-bold text-gray-500 uppercase">Nota (opcional)</label>
                  <textarea
                    id="modal-observation"
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    placeholder="Agregar observación..."
                    rows={2}
                    className="mt-1 w-full px-3 py-2 bg-gray-100 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>
              
              {/* Footer fijo */}
              <div className="p-4 border-t flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={closeJobModal}
                  className="flex-1 py-2.5 bg-gray-200 rounded-lg text-sm font-bold text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveJobInfo(modalEntry)}
                  disabled={isSavingJob}
                  className="flex-1 py-2.5 bg-emerald-500 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                >
                  {isSavingJob ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </Card>
  )
}
