'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Clock, Smartphone, Settings, Hash, Pencil, Bus, MessageSquare } from 'lucide-react'
import { formatDuration, formatCurrency, HOURLY_RATE, formatTimeInFlorida } from '@/lib/utils'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { useWakeLock } from '@/hooks/useWakeLock'
import type { TimerState } from '@/types'

const VEHICLE_OPTIONS = [
  { value: 'sprinter', label: 'Sprinter', short: 'Sprinter' },
  { value: 'mini-bus', label: 'Mini Bus', short: 'Mini Bus' },
  { value: 'motorcoach', label: 'Motorcoach', short: 'Motor C.' },
]

function getVehicleLabel(value: string): string {
  const vehicle = VEHICLE_OPTIONS.find(v => v.value === value)
  return vehicle ? vehicle.label : value
}

interface TimerProps {
  readonly onTimerStop?: () => void
  readonly initialState?: TimerState
  readonly hourlyRate?: number
  readonly onRateChange?: (newRate: number) => void
}

export function Timer({ onTimerStop, initialState, hourlyRate = HOURLY_RATE, onRateChange }: Readonly<TimerProps>) {
  const [isRunning, setIsRunning] = useState(initialState?.isRunning || false)
  const [elapsedSeconds, setElapsedSeconds] = useState(initialState?.elapsedSeconds || 0)
  const [startTime, setStartTime] = useState<Date | null>(
    initialState?.startTime ? new Date(initialState.startTime) : null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditingRate, setIsEditingRate] = useState(false)
  const [tempRate, setTempRate] = useState(hourlyRate.toString())
  const [jobNumber, setJobNumber] = useState('')
  const [isEditingJobNumber, setIsEditingJobNumber] = useState(false)
  const [jobNumberInput, setJobNumberInput] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [observation, setObservation] = useState('')
  const [isEditingObservation, setIsEditingObservation] = useState(false)
  const [observationInput, setObservationInput] = useState('')
  const [result, setResult] = useState<{ duration: number; earnings: number; jobNumber?: string; vehicle?: string } | null>(null)
  
  // PWA and background support
  const { startBackgroundTimer, stopBackgroundTimer } = useServiceWorker()
  const { requestWakeLock, releaseWakeLock, isActive: wakeLockActive } = useWakeLock()

  // Cargar estado inicial
  useEffect(() => {
    async function loadTimerState() {
      try {
        const res = await fetch('/api/timer')
        const data = await res.json()
        
        if (!data.success || !data.data) return
        
        const { isRunning: running, elapsedSeconds: elapsed, jobNumber: job, vehicle } = data.data
        setIsRunning(running)
        
        if (running && elapsed !== undefined) {
          setStartTime(new Date(Date.now() - (elapsed * 1000)))
          setElapsedSeconds(elapsed)
        } else {
          setElapsedSeconds(0)
        }
        
        if (job) setJobNumber(job)
        if (vehicle) setVehicleType(vehicle)
        if (data.data.observation) setObservation(data.data.observation)
      } catch (err) {
        console.error('Error loading timer state:', err)
      }
    }
    
    loadTimerState()
  }, [])

  // Actualizar timer cada segundo
  useEffect(() => {
    if (!isRunning || !startTime) return

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      setElapsedSeconds(Math.max(0, elapsed))
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, startTime])

  const resetTimerState = useCallback(() => {
    setIsRunning(false)
    setStartTime(null)
    setElapsedSeconds(0)
    setJobNumber('')
    setVehicleType('')
    setObservation('')
  }, [])

  const handleStart = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      await requestWakeLock()
      
      const res = await fetch('/api/timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime: new Date().toISOString() })
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Error al iniciar')
        await releaseWakeLock()
        return
      }
      
      const newStartTime = new Date()
      setIsRunning(true)
      setStartTime(newStartTime)
      setElapsedSeconds(0)
      setJobNumber('')
      setVehicleType('')
      setObservation('')
      startBackgroundTimer(newStartTime.toISOString())
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [requestWakeLock, releaseWakeLock, startBackgroundTimer])

  const handleStop = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/timer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime: new Date().toISOString(), jobNumber, vehicle: vehicleType, observation })
      })
      const data = await res.json()

      if (data.success) {
        const savedJobNumber = jobNumber
        const savedVehicle = vehicleType
        const finalDuration = elapsedSeconds
        const finalEarnings = (elapsedSeconds / 3600) * hourlyRate
        
        resetTimerState()
        stopBackgroundTimer()
        await releaseWakeLock()
        
        setResult({
          duration: finalDuration,
          earnings: finalEarnings,
          jobNumber: savedJobNumber || data.data.entry?.jobNumber,
          vehicle: savedVehicle || data.data.entry?.vehicle
        })
        
        onTimerStop?.()
      } else {
        setError(data.error || 'Error al detener')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [onTimerStop, stopBackgroundTimer, releaseWakeLock, jobNumber, vehicleType, observation, elapsedSeconds, hourlyRate, resetTimerState])

  const currentEarnings = (elapsedSeconds / 3600) * hourlyRate

  const handleSaveJobNumber = useCallback(async () => {
    try {
      const res = await fetch('/api/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobNumber: jobNumberInput })
      })
      const data = await res.json()

      if (data.success) {
        setJobNumber(jobNumberInput)
        setIsEditingJobNumber(false)
      } else {
        setError(data.error || 'Error al guardar')
      }
    } catch (err) {
      console.error('Error saving job number:', err)
      setError('Error de conexión')
    }
  }, [jobNumberInput])

  const handleEditJobNumber = useCallback(() => {
    setJobNumberInput(jobNumber)
    setIsEditingJobNumber(true)
  }, [jobNumber])

  const handleCancelEditJobNumber = useCallback(() => {
    setIsEditingJobNumber(false)
    setJobNumberInput('')
  }, [])

  const handleSaveObservation = useCallback(async () => {
    try {
      const res = await fetch('/api/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observation: observationInput })
      })
      const data = await res.json()
      if (data.success) {
        setObservation(observationInput)
        setIsEditingObservation(false)
      } else {
        setError(data.error || 'Error al guardar comentario')
      }
    } catch (err) {
      console.error('Error saving observation:', err)
      setError('Error de conexión')
    }
  }, [observationInput])

  const handleEditObservation = useCallback(() => {
    setObservationInput(observation)
    setIsEditingObservation(true)
  }, [observation])

  const handleCancelEditObservation = useCallback(() => {
    setIsEditingObservation(false)
    setObservationInput('')
  }, [])

  const handleSelectVehicle = async (selectedVehicle: string) => {
    setVehicleType(prev => prev === selectedVehicle ? '' : selectedVehicle)
    
    // Guardar el vehículo en el servidor
    try {
      await fetch('/api/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle: selectedVehicle })
      })
    } catch (err) {
      console.error('Error saving vehicle:', err)
    }
  }

  const handleSaveRate = useCallback(async () => {
    const newRate = Number.parseFloat(tempRate)
    if (Number.isNaN(newRate) || newRate <= 0) {
      setError('Tarifa inválida')
      return
    }
    
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hourlyRate: newRate })
      })
      const data = await res.json()
      
      if (data.success) {
        setIsEditingRate(false)
        onRateChange?.(newRate)
      } else {
        setError(data.error || 'Error al guardar tarifa')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    }
  }, [tempRate, onRateChange])

  const handleCancelRateEdit = useCallback(() => {
    setIsEditingRate(false)
    setTempRate(hourlyRate.toString())
  }, [hourlyRate])

  const handleStartRateEdit = useCallback(() => {
    setTempRate(hourlyRate.toString())
    setIsEditingRate(true)
  }, [hourlyRate])

  const renderBackgroundIndicator = () => {
    if (!isRunning || !wakeLockActive) return null
    return (
      <div className="flex items-center justify-center gap-1 text-[12px] text-[#787774] mt-1">
        <Smartphone className="h-3 w-3 animate-pulse" />
        <span>Modo background activo</span>
      </div>
    )
  }

  const renderStartTimeIndicator = () => {
    if (!isRunning || !startTime) return null
    return (
      <div className="text-[12px] text-[#787774] mt-1">
        Iniciado: {formatTimeInFlorida(startTime)}
      </div>
    )
  }

  const renderJobNumberSection = () => {
    if (!isRunning) return null
    return (
      <div className="rounded-[6px] border border-[rgba(55,53,47,0.09)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#787774]">
            <Hash className="h-3.5 w-3.5" />
            <span className="text-[13px]">Trabajo #</span>
          </div>
          {isEditingJobNumber ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={jobNumberInput}
                onChange={(e) => setJobNumberInput(e.target.value)}
                placeholder="Ej: 12345"
                className="w-24 px-2 py-1.5 text-[13px] font-mono rounded-[4px] border border-[rgba(55,53,47,0.16)] focus:border-[#37352f] focus:outline-none text-center text-[#37352f]"
                style={{ fontSize: '16px' }}
                autoFocus
              />
              <button type="button" onClick={handleSaveJobNumber} className="px-2.5 py-1.5 text-[12px] bg-[#37352f] text-white rounded-[4px] hover:bg-[#2f2d28] transition-colors">OK</button>
              <button type="button" onClick={handleCancelEditJobNumber} className="px-2 py-1.5 text-[12px] text-[#787774] hover:text-[#37352f] rounded-[4px] hover:bg-[rgba(55,53,47,0.08)] transition-colors">✕</button>
            </div>
          ) : (
            <button type="button" onClick={handleEditJobNumber} className="flex items-center gap-1.5 text-[13px] text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] px-2 py-1 rounded-[4px] transition-colors">
              <span className={jobNumber ? "font-mono font-semibold" : "text-[#787774]"}>
                {jobNumber || 'Asignar número'}
              </span>
              <Pencil className="h-3 w-3 text-[#787774]" />
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderObservationSection = () => {
    if (!isRunning) return null
    return (
      <div className="rounded-[6px] border border-[rgba(55,53,47,0.09)] p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-[#787774] pt-0.5">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="text-[13px]">Comentario</span>
          </div>
          {isEditingObservation ? (
            <div className="flex flex-col gap-2 flex-1">
              <textarea
                value={observationInput}
                onChange={(e) => setObservationInput(e.target.value)}
                placeholder="Ej: Pasajero especial, retraso..."
                className="w-full px-2 py-1.5 text-[13px] rounded-[4px] border border-[rgba(55,53,47,0.16)] focus:border-[#37352f] focus:outline-none resize-none text-[#37352f]"
                rows={2}
                style={{ fontSize: '16px' }}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={handleSaveObservation} className="px-2.5 py-1.5 text-[12px] bg-[#37352f] text-white rounded-[4px] hover:bg-[#2f2d28] transition-colors">Guardar</button>
                <button type="button" onClick={handleCancelEditObservation} className="px-2 py-1.5 text-[12px] text-[#787774] hover:text-[#37352f] rounded-[4px] hover:bg-[rgba(55,53,47,0.08)] transition-colors">✕</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={handleEditObservation} className="flex items-start gap-1.5 text-[13px] text-left flex-1 hover:bg-[rgba(55,53,47,0.08)] px-2 py-1 rounded-[4px] transition-colors">
              <span className={observation ? 'text-[#37352f] whitespace-pre-wrap' : 'text-[#787774]'}>
                {observation || 'Agregar comentario'}
              </span>
              <Pencil className="h-3 w-3 text-[#787774] flex-shrink-0 mt-0.5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderVehicleSection = () => {
    if (!isRunning) return null
    return (
      <div className="rounded-[6px] border border-[rgba(55,53,47,0.09)] p-3">
        <div className="flex items-center gap-2 text-[#787774] mb-2.5">
          <Bus className="h-3.5 w-3.5" />
          <span className="text-[13px]">Vehículo</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {VEHICLE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => handleSelectVehicle(option.value)}
              className={"px-2 py-2 rounded-[4px] text-[13px] transition-colors truncate touch-manipulation " + (vehicleType === option.value ? 'bg-[#37352f] text-white' : 'bg-transparent text-[#37352f] border border-[rgba(55,53,47,0.16)] hover:bg-[rgba(55,53,47,0.06)]')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderResultSection = () => {
    if (!result || isRunning) return null
    return (
      <div className="rounded-[6px] border border-[rgba(55,53,47,0.09)] p-4">
        <div className="flex items-center justify-center gap-2 text-[#37352f] mb-3">
          <Clock className="h-4 w-4" />
          <span className="text-[14px] font-medium">Turno completado</span>
        </div>
        {(result.jobNumber ?? result.vehicle) && (
          <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
            {result.jobNumber && <span className="px-2 py-1 bg-[rgba(55,53,47,0.08)] text-[#37352f] text-[12px] font-mono rounded-[4px]">#{result.jobNumber}</span>}
            {result.vehicle && <span className="px-2 py-1 bg-[rgba(55,53,47,0.08)] text-[#37352f] text-[12px] rounded-[4px] flex items-center gap-1"><Bus className="h-3 w-3" />{getVehicleLabel(result.vehicle)}</span>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-[12px] text-[#787774]">Duración</div>
            <div className="text-[18px] font-semibold text-[#37352f]">{formatDuration(result.duration)}</div>
          </div>
          <div>
            <div className="text-[12px] text-[#787774]">Ganado</div>
            <div className="text-[18px] font-semibold text-[#37352f]">{formatCurrency(result.earnings)}</div>
          </div>
        </div>
      </div>
    )
  }

  const renderRateEditor = () => {
    if (!isEditingRate) {
      return (
        <button type="button" onClick={handleStartRateEdit} className="text-[12px] text-[#787774] hover:text-[#37352f] flex items-center justify-center gap-1 mx-auto py-1 hover:bg-[rgba(55,53,47,0.08)] px-2 rounded-[4px] transition-colors">
          <Settings className="h-3 w-3" />
          Tarifa: ${hourlyRate}/hora
        </button>
      )
    }
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="text-[13px] text-[#787774]">$</span>
        <input type="number" value={tempRate} onChange={(e) => setTempRate(e.target.value)} className="w-20 px-2 py-1 text-center text-[13px] border border-[rgba(55,53,47,0.16)] rounded-[4px] focus:outline-none focus:border-[#37352f]" step="0.01" min="0" />
        <span className="text-[13px] text-[#787774]">/hora</span>
        <button type="button" onClick={handleSaveRate} className="text-[13px] text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] px-2 py-1 rounded-[4px] transition-colors">✓</button>
        <button type="button" onClick={handleCancelRateEdit} className="text-[13px] text-[#787774] hover:bg-[rgba(55,53,47,0.08)] px-2 py-1 rounded-[4px] transition-colors">✕</button>
      </div>
    )
  }

  return (
    <div className="w-full rounded-[6px] border border-[rgba(55,53,47,0.09)] bg-white overflow-hidden">
      <div className="space-y-3 px-4 pt-5 pb-5">
        {/* Timer Display */}
        <div className="text-center py-4">
          <div className={"text-[56px] sm:text-[72px] font-mono font-bold tracking-tight transition-colors " + (isRunning ? 'text-[#37352f]' : 'text-[rgba(55,53,47,0.3)]')}>
            {formatDuration(elapsedSeconds)}
          </div>
          <div className={"text-[22px] sm:text-[28px] mt-1 font-semibold transition-colors " + (isRunning ? 'text-[#37352f]' : 'text-[rgba(55,53,47,0.25)]')}>
            {formatCurrency(currentEarnings)}
          </div>
          {renderStartTimeIndicator()}
          {renderBackgroundIndicator()}
        </div>

        {renderJobNumberSection()}
        {renderVehicleSection()}
        {renderObservationSection()}
        {renderResultSection()}

        {/* Error Message */}
        {error && (
          <div className="text-[13px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] py-2 px-3 rounded-[4px]">{error}</div>
        )}

        {/* Buttons */}
        <div className="flex justify-center pt-1">
          {isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              disabled={isLoading}
              className="w-full py-3 text-[15px] font-semibold bg-[#37352f] hover:bg-[#2f2d28] disabled:opacity-60 text-white rounded-[6px] transition-colors flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99]"
            >
              <Square className="h-4 w-4" />
              {isLoading ? 'Deteniendo...' : 'DETENER'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={isLoading}
              className="w-full py-3 text-[15px] font-semibold bg-[#37352f] hover:bg-[#2f2d28] disabled:opacity-60 text-white rounded-[6px] transition-colors flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99]"
            >
              <Play className="h-4 w-4" />
              {isLoading ? 'Iniciando...' : 'INICIAR'}
            </button>
          )}
        </div>

        {/* Rate Info */}
        <div className="text-center pt-1">
          {renderRateEditor()}
        </div>
      </div>
    </div>
  )
}
