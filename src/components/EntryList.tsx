'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, HOURLY_RATE, formatTimeInFlorida, formatShortDateFlorida, getFloridaDateComponents } from '@/lib/utils'
import { Clock, Trash2, Pencil, X, Check, ChevronDown, ChevronRight, Eye, FileText, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  const [vehicleModal, setVehicleModal] = useState('')
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
  }

  const closeJobModal = () => {
    setJobModalEntryId(null)
    setJobNumber('')
    setVehicleModal('')
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
          vehicle: vehicleModal || null,
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
            <div
              key={entry.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 gap-2"
            >
              <div className="flex-1 min-w-0">
                {showDate && (
                  <div className="text-xs text-gray-500 mb-1">
                    {formatShortDateFlorida(entry.date)}
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
                        <div className="flex items-center gap-1 mt-1 pt-1 border-t border-gray-200">
                          {entry.jobNumber && (
                            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm truncate max-w-[80px] sm:max-w-none">
                              #{entry.jobNumber}
                            </span>
                          )}
                          {entry.vehicle && (
                            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-gradient-to-r from-slate-500 to-gray-600 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm">
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
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openJobModal(entry)}
                          className={`h-7 w-7 sm:h-8 sm:w-8 ${entry.jobNumber ? 'text-blue-500 hover:text-blue-600 hover:bg-blue-50' : 'text-purple-400 hover:text-purple-600 hover:bg-purple-50'}`}
                          title="Información del trabajo"
                        >
                          <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
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
      
      {/* Modal de información del trabajo - Diseño moderno */}
      {jobModalEntryId && (() => {
        const modalEntry = entries.find(e => e.id === jobModalEntryId)
        if (!modalEntry) return null
        
        const calculatedAmount = getCalculatedAmount(modalEntry)
        const paid = paidAmount ? Number.parseFloat(paidAmount) : 0
        const difference = paid - calculatedAmount
        const isPositive = difference >= 0
        
        return (
          <>
            {/* Overlay con blur */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
              aria-hidden="true"
              onClick={closeJobModal}
            />
            {/* Modal - Diseño moderno y responsive */}
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
                <div className="bg-gradient-to-b from-white to-gray-50 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-slide-in-from-bottom-4">
                  
                  {/* Header con gradiente */}
                  <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-5 py-6 sm:px-6 sm:py-7">
                    <button
                      onClick={closeJobModal}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors duration-200"
                      aria-label="Cerrar"
                    >
                      <X className="h-5 w-5 text-white" />
                    </button>
                    
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <FileText className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white">
                          Detalles del Trabajo
                        </h3>
                        <p className="text-blue-100 text-sm mt-0.5">
                          Registra la información de tu servicio
                        </p>
                      </div>
                    </div>
                    
                    {/* Badge de tiempo trabajado */}
                    <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                      <Clock className="h-4 w-4 text-white" />
                      <span className="text-white font-mono font-semibold text-lg">
                        {modalEntry.duration ? formatDuration(modalEntry.duration) : '--:--:--'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Contenido del formulario */}
                  <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 space-y-5">
                    
                    {/* Grid de campos principales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Número de trabajo */}
                      <div className="space-y-2">
                        <label htmlFor="jobNumber" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-100 text-blue-600 text-xs font-bold">#</span>
                          <span>Número de Trabajo</span>
                        </label>
                        <input
                          id="jobNumber"
                          type="text"
                          value={jobNumber}
                          onChange={(e) => setJobNumber(e.target.value)}
                          placeholder="Ej: 196088"
                          className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder:text-gray-400"
                        />
                      </div>
                      
                      {/* Vehículo */}
                      <div className="space-y-2">
                        <label htmlFor="vehicleModal" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-600 text-xs">🚐</span>
                          <span>Vehículo</span>
                        </label>
                        <select
                          id="vehicleModal"
                          value={vehicleModal}
                          onChange={(e) => setVehicleModal(e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900 cursor-pointer appearance-none"
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px' }}
                        >
                          <option value="">Seleccionar...</option>
                          <option value="sprinter">🚐 Sprinter</option>
                          <option value="mini-bus">🚌 Mini Bus</option>
                          <option value="motorcoach">🚍 Motorcoach</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Tarjeta de monto calculado */}
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-4 sm:p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 mb-1">
                            <DollarSign className="h-4 w-4" />
                            Monto Calculado
                          </div>
                          <div className="text-3xl sm:text-4xl font-bold text-emerald-600 tracking-tight">
                            {formatCurrency(calculatedAmount)}
                          </div>
                        </div>
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100">
                          <span className="text-2xl">💰</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-emerald-200">
                        <p className="text-sm text-emerald-600 font-medium">
                          {modalEntry.duration ? (modalEntry.duration / 3600).toFixed(2) : 0} hrs × {formatCurrency(hourlyRate)}/hr
                        </p>
                      </div>
                    </div>
                    
                    {/* Campo de monto pagado */}
                    <div className="space-y-2">
                      <label htmlFor="paidAmount" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-purple-100 text-purple-600 text-xs">💵</span>
                        <span>Monto Pagado por la Compañía</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-gray-500 font-semibold text-lg">$</span>
                        </div>
                        <input
                          id="paidAmount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-9 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200 text-xl font-semibold text-gray-900 placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                    
                    {/* Tarjeta de diferencia */}
                    {paidAmount && (
                      <div className={`rounded-2xl p-5 transition-all duration-300 ${
                        isPositive 
                          ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200' 
                          : 'bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className={`text-sm font-semibold mb-1 ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                              {isPositive ? '✨ Diferencia a favor' : '⚠️ Diferencia en contra'}
                            </div>
                            <div className={`text-3xl sm:text-4xl font-bold tracking-tight ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                            </div>
                            <p className={`text-sm mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositive 
                                ? `¡Excelente! Ganaste ${formatCurrency(difference)} extra`
                                : `Te deben ${formatCurrency(Math.abs(difference))}`
                              }
                            </p>
                          </div>
                          <div className={`flex items-center justify-center w-16 h-16 rounded-2xl ${
                            isPositive ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            <span className="text-4xl">{isPositive ? '🎉' : '😔'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Footer con botones */}
                  <div className="px-5 py-4 sm:px-6 sm:py-5 bg-white border-t border-gray-100 pb-safe">
                    <div className="flex gap-3">
                      <button
                        onClick={closeJobModal}
                        className="flex-1 px-6 py-3.5 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 active:scale-[0.98]"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleSaveJobInfo(modalEntry)}
                        disabled={isSavingJob}
                        className="flex-1 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl font-semibold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        {isSavingJob ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Guardando...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <Check className="h-5 w-5" />
                            Guardar
                          </span>
                        )}
                      </button>
                    </div>
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
