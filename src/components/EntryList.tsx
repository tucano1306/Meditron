'use client'

import { useState } from 'react'
import { formatDuration, formatCurrency, HOURLY_RATE, formatTimeInFlorida, formatShortDateFlorida, getFloridaDateComponents } from '@/lib/utils'
import { Clock, Trash2, Pencil, X, Check, ChevronDown, ChevronRight } from 'lucide-react'

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
  
  // Estado para expansión inline de detalles del trabajo
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [jobNumber, setJobNumber] = useState('')
  const [vehicleValue, setVehicleValue] = useState('')
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

  // Funciones para expansión inline del trabajo  
  const toggleJobExpansion = (entry: Entry) => {
    if (expandedJobId === entry.id) {
      // Cerrar
      setExpandedJobId(null)
      setJobNumber('')
      setVehicleValue('')
      setPaidAmount('')
      setObservation('')
    } else {
      // Abrir
      setExpandedJobId(entry.id)
      setJobNumber(entry.jobNumber || '')
      setVehicleValue(entry.vehicle || '')
      setPaidAmount(entry.paidAmount?.toString() || '')
      setObservation(entry.observation || '')
    }
  }

  const closeJobExpansion = () => {
    setExpandedJobId(null)
    setJobNumber('')
    setVehicleValue('')
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
          vehicle: vehicleValue || null,
          observation: observation || null,
          calculatedAmount,
          paidAmount: paidAmount ? Number.parseFloat(paidAmount) : null,
          startTime: entry.startTime,
          endTime: entry.endTime
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        closeJobExpansion()
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
      <div className="rounded-[6px] border border-[rgba(55,53,47,0.09)] bg-white px-4 py-8 text-center">
        <Clock className="h-8 w-8 text-[rgba(55,53,47,0.2)] mx-auto mb-2" />
        <p className="text-[14px] text-[#787774]">{title}</p>
        <p className="text-[13px] text-[rgba(55,53,47,0.4)] mt-1">No hay entradas registradas</p>
      </div>
    )
  }

  const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0)

  return (
    <div className="rounded-[6px] border border-[rgba(55,53,47,0.09)] bg-white overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[rgba(55,53,47,0.09)] hover:bg-[rgba(55,53,47,0.04)] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[#787774]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#787774]" />
          )}
          <Clock className="h-3.5 w-3.5 text-[#787774]" />
          <span className="text-[14px] font-medium text-[#37352f]">{title}</span>
          <span className="px-1.5 py-0.5 bg-[rgba(55,53,47,0.08)] text-[#37352f] text-[11px] font-mono rounded-[3px]">{entries.length}</span>
        </div>
        {!isExpanded && (
          <div className="flex items-center gap-2 text-[13px] text-[#787774]">
            <span className="font-mono">{formatDuration(totalDuration)}</span>
            <span>·</span>
            <span>{formatCurrency((totalDuration / 3600) * hourlyRate)}</span>
          </div>
        )}
      </button>
      
      {isExpanded && (
        <div className="divide-y divide-[rgba(55,53,47,0.09)]">
          {entries.map((entry) => renderEntryRow(entry))}
        </div>
      )}
    </div>
  )

  function renderEntryRow(entry: Entry) {
    const isJobExpanded = expandedJobId === entry.id
    const calculatedAmount = getCalculatedAmount(entry)
    const paid = paidAmount ? Number.parseFloat(paidAmount) : 0
    const difference = paid - calculatedAmount
    const isPositive = difference >= 0
    const isClickable = !!(entry.endTime && entry.duration !== null && editingId !== entry.id)
    const rowBaseClass = "flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2 hover:bg-[rgba(55,53,47,0.04)] transition-colors"

    const rowContent = (
      <>
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
                onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => e.stopPropagation()}
                  className="px-1 sm:px-2 py-1.5 text-sm border rounded w-[72px] sm:w-20 text-center"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#37352f] font-mono">
                {formatTimeInFlorida(entry.startTime)}
                <span className="text-[#787774] mx-1">→</span>
                {entry.endTime
                  ? formatTimeInFlorida(entry.endTime)
                  : <span className="text-[#787774] animate-pulse">En progreso...</span>}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-2">
          <div className="text-right flex-1 min-w-0">
            {entry.duration === null || entry.endTime === null ? (
              <div className="text-[12px] text-[#787774] animate-pulse">En curso</div>
            ) : (
              <div className="flex flex-col items-end gap-0.5">
                <div className="font-mono text-[13px] text-[#37352f]">
                  {formatDuration(entry.duration)}
                </div>
                <div className="text-[13px] text-[#37352f] font-medium">
                  {formatCurrency((entry.duration / 3600) * hourlyRate)}
                </div>
                {(entry.jobNumber || entry.vehicle) && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap justify-end">
                    {entry.jobNumber && (
                      <span className="px-1.5 py-0.5 bg-[rgba(55,53,47,0.08)] text-[#37352f] text-[11px] font-mono rounded-[3px]">
                        #{entry.jobNumber}
                      </span>
                    )}
                    {entry.vehicle && (
                      <span className="px-1.5 py-0.5 bg-[rgba(55,53,47,0.08)] text-[#37352f] text-[11px] rounded-[3px]">
                        {entry.vehicle}
                      </span>
                    )}
                    {entry.paidAmount !== null && entry.paidAmount !== undefined && (() => {
                      const calculated = (entry.duration / 3600) * hourlyRate
                      const diff = entry.paidAmount - calculated
                      const diffPositive = diff >= 0
                      return (
                        <span className={"text-[11px] " + (diffPositive ? 'text-[#37352f]' : 'text-[#dc2626]')}>
                          {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                        </span>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
          {entry.endTime && entry.duration !== null && (
            <div className="flex items-center flex-shrink-0 ml-1">
              {editingId === entry.id ? (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(entry)}
                    disabled={isSaving}
                    className="p-1.5 text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] rounded-[4px] transition-colors disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={isSaving}
                    className="p-1.5 text-[#787774] hover:bg-[rgba(55,53,47,0.08)] rounded-[4px] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); startEditing(entry) }}
                    className="p-1.5 text-[#787774] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] rounded-[4px] transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(entry.id) }}
                    className="p-1.5 text-[#787774] hover:text-[#dc2626] hover:bg-[rgba(220,38,38,0.08)] rounded-[4px] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </>
    )

    return (
      <div key={entry.id} className="space-y-0">
        {isClickable ? (
          <button
            type="button"
            className={`${rowBaseClass} w-full text-left active:scale-[0.99]`}
            onClick={() => toggleJobExpansion(entry)}
          >
            {rowContent}
          </button>
        ) : (
          <div className={rowBaseClass}>
            {rowContent}
          </div>
        )}

        {/* Panel expandido inline */}
        {isJobExpanded && (
          <div className="bg-[rgba(55,53,47,0.04)] border-t border-[rgba(55,53,47,0.09)] px-4 py-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`job-${entry.id}`} className="text-[12px] text-[#787774]">Job #</label>
                <input
                  id={`job-${entry.id}`}
                  type="text"
                  inputMode="numeric"
                  value={jobNumber}
                  onChange={(e) => setJobNumber(e.target.value)}
                  placeholder="123456"
                  className="mt-1 w-full px-2 py-1.5 text-[13px] bg-white border border-[rgba(55,53,47,0.16)] rounded-[4px] focus:border-[#37352f] focus:outline-none text-[#37352f]"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <div>
                <label htmlFor={`vehicle-${entry.id}`} className="text-[12px] text-[#787774]">Vehículo</label>
                <select
                  id={`vehicle-${entry.id}`}
                  value={vehicleValue}
                  onChange={(e) => setVehicleValue(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-[13px] bg-white border border-[rgba(55,53,47,0.16)] rounded-[4px] focus:border-[#37352f] focus:outline-none text-[#37352f]"
                  style={{ fontSize: '16px' }}
                >
                  <option value="">Ninguno</option>
                  <option value="sprinter">Sprinter</option>
                  <option value="mini-bus">Mini Bus</option>
                  <option value="motorcoach">Motorcoach</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-[4px] px-3 py-2.5 border border-[rgba(55,53,47,0.09)]">
              <div>
                <span className="text-[12px] text-[#787774]">Calculado</span>
                <p className="text-[15px] font-semibold text-[#37352f]">{formatCurrency(calculatedAmount)}</p>
              </div>
              <div className="text-right">
                <label htmlFor={`paid-${entry.id}`} className="text-[12px] text-[#787774]">Pagado</label>
                <div className="flex items-center gap-1">
                  <span className="text-[13px] text-[#787774]">$</span>
                  <input
                    id={`paid-${entry.id}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-20 px-2 py-1 bg-[rgba(55,53,47,0.04)] rounded-[4px] text-right text-[13px] focus:outline-none focus:border-[#37352f] border border-transparent focus:border"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>
            </div>

            {paidAmount && Number.parseFloat(paidAmount) > 0 && (
              <div className={"text-center py-2 rounded-[4px] text-[13px] " + (isPositive ? 'bg-[rgba(55,53,47,0.06)] text-[#37352f]' : 'bg-[rgba(220,38,38,0.06)] text-[#dc2626]')}>
                {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
              </div>
            )}

            <div>
              <label htmlFor={`note-${entry.id}`} className="text-[12px] text-[#787774]">Nota</label>
              <textarea
                id={`note-${entry.id}`}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Agregar nota..."
                rows={2}
                className="mt-1 w-full px-2 py-1.5 text-[13px] bg-white border border-[rgba(55,53,47,0.16)] rounded-[4px] focus:border-[#37352f] focus:outline-none resize-none text-[#37352f]"
                style={{ fontSize: '16px' }}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeJobExpansion}
                className="flex-1 py-2 text-[13px] text-[#787774] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] rounded-[4px] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveJobInfo(entry)}
                disabled={isSavingJob}
                className="flex-1 py-2 text-[13px] bg-[#37352f] text-white hover:bg-[#2f2d28] rounded-[4px] transition-colors disabled:opacity-50"
              >
                {isSavingJob ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
}
