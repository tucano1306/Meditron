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
                  {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
              aria-hidden="true"
              onClick={closeJobModal}
            />
            {/* Modal - Bottom sheet en móvil, centrado en desktop */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div className="fixed inset-0 z-[9999] flex items-end sm:items-center sm:justify-center overflow-hidden" onClick={closeJobModal}>
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <div 
                className="w-full sm:max-w-[380px] sm:mx-4 bg-white sm:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                  
                  {/* Drag handle - solo móvil */}
                  <div className="sm:hidden flex justify-center pt-2 pb-1">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                  </div>

                  {/* Header */}
                  <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 sm:rounded-t-xl">
                    <button
                      onClick={closeJobModal}
                      className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 touch-manipulation z-10"
                      aria-label="Cerrar"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                    
                    <div className="flex items-center gap-2 pr-10">
                      <FileText className="h-4 w-4 text-white/80 flex-shrink-0" />
                      <h3 className="text-sm font-bold text-white flex-1">Detalles del Trabajo</h3>
                      <div className="bg-white/20 rounded-full px-2.5 py-0.5 flex-shrink-0">
                        <span className="text-white font-mono font-bold text-xs">
                          {modalEntry.duration ? formatDuration(modalEntry.duration) : '--:--:--'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contenido scrollable */}
                  <div 
                    className="overflow-y-auto overscroll-contain px-4 py-3 space-y-3 flex-1 min-h-0"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' } as React.CSSProperties}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    
                    {/* Trabajo + Vehículo */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="jobNumberModal" className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"># Trabajo</label>
                        <input
                          id="jobNumberModal"
                          type="text"
                          inputMode="numeric"
                          value={jobNumber}
                          onChange={(e) => setJobNumber(e.target.value)}
                          placeholder="196088"
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                      <div>
                        <label htmlFor="vehicleModalSelect" className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">🚐 Vehículo</label>
                        <select
                          id="vehicleModalSelect"
                          value={vehicleModal}
                          onChange={(e) => setVehicleModal(e.target.value)}
                          className="w-full px-2 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation text-sm sm:text-base"
                          style={{ fontSize: '16px' }}
                        >
                          <option value="">Sin vehículo</option>
                          <option value="sprinter">🚐 Sprinter</option>
                          <option value="mini-bus">🚌 Mini Bus</option>
                          <option value="motorcoach">🚍 Motorcoach</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Monto Calculado */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-semibold text-emerald-600 uppercase">Monto Calculado</div>
                          <div className="text-xl font-bold text-emerald-700">{formatCurrency(calculatedAmount)}</div>
                        </div>
                        <div className="text-right text-[10px] text-emerald-600 leading-relaxed">
                          {modalEntry.duration ? (modalEntry.duration / 3600).toFixed(2) : 0} hrs<br/>
                          × {formatCurrency(hourlyRate)}/hr
                        </div>
                      </div>
                    </div>
                    
                    {/* Monto Pagado */}
                    <div>
                      <label htmlFor="paidAmountModal" className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">💵 Monto Pagado por Compañía</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                        <input
                          id="paidAmountModal"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                    </div>
                    
                    {/* Diferencia */}
                    {paidAmount && (
                      <div className={`rounded-lg p-3 ${isPositive ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                            {isPositive ? '✓ A favor' : '✗ En contra'}
                          </span>
                          <span className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Observación */}
                    <div>
                      <label htmlFor="observationModal" className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">📝 Observación</label>
                      <textarea
                        id="observationModal"
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        placeholder="Agregar una nota..."
                        rows={2}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation resize-none"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                  </div>
                  
                  {/* Botones siempre visibles */}
                  <div className="px-4 py-3 flex gap-3 border-t border-gray-100 bg-white sm:rounded-b-xl">
                    <button
                      onClick={closeJobModal}
                      className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] touch-manipulation"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSaveJobInfo(modalEntry)}
                      disabled={isSavingJob}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-60 touch-manipulation"
                    >
                      {isSavingJob ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
              </div>
            </div>
          </>
        )
      })()}
    </Card>
  )
}
