'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Pause, Clock, Smartphone, Settings, Hash, Pencil, Bus, MessageSquare, ArrowLeftRight, Building2 } from 'lucide-react'
import { formatDuration, formatCurrency, HOURLY_RATE, formatTimeInFlorida } from '@/lib/utils'
import { COMPANIES, COMPANY_IDS, isCompanyId, overtimeAmount, type CompanyId } from '@/lib/companies'
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
  /** Compañía con la que se inicia el próximo trabajo */
  readonly company?: CompanyId
  /** Segundos de Tecnofuel ya cerrados en la semana de pago actual (para el overtime en vivo) */
  readonly tecnofuelPriorSeconds?: number
  /** Avisa cuando cambia la compañía del trabajo en curso (al iniciarlo o al cambiarla) */
  readonly onCompanyChange?: () => void
}

export function Timer({ onTimerStop, initialState, hourlyRate = HOURLY_RATE, onRateChange, company = 'larrys', tecnofuelPriorSeconds = 0, onCompanyChange }: Readonly<TimerProps>) {
  const [isRunning, setIsRunning] = useState(initialState?.isRunning || false)
  const [isPaused, setIsPaused] = useState(initialState?.isPaused || false)
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
  const [serviceType, setServiceType] = useState('')
  const [observation, setObservation] = useState('')
  const [isEditingObservation, setIsEditingObservation] = useState(false)
  const [observationInput, setObservationInput] = useState('')
  const [result, setResult] = useState<{ duration: number; earnings: number; jobNumber?: string; vehicle?: string; company?: CompanyId } | null>(null)
  // Compañía del trabajo en curso (sale de su nota); sin trabajo en curso manda la vista elegida
  const [entryCompany, setEntryCompany] = useState<CompanyId | null>(null)
  
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
        
        const { isRunning: running, isPaused: paused, elapsedSeconds: elapsed, jobNumber: job, vehicle, accumulatedSeconds: accumulated } = data.data
        setIsRunning(running)
        setIsPaused(!!paused)
        
        if (paused && elapsed !== undefined) {
          setElapsedSeconds(elapsed)
          setStartTime(null)
        } else if (running && elapsed !== undefined) {
          setStartTime(new Date(Date.now() - (elapsed * 1000)))
          setElapsedSeconds(elapsed)
        } else {
          setElapsedSeconds(0)
        }
        
        if (accumulated !== undefined) {
          // accumulatedSeconds is already reflected in elapsedSeconds
        }
        
        if (isCompanyId(data.data.company)) setEntryCompany(data.data.company)
        if (job) setJobNumber(job)
        if (vehicle) setVehicleType(vehicle)
        if (data.data.serviceType) setServiceType(data.data.serviceType)
        if (data.data.observation) setObservation(data.data.observation)
      } catch (err) {
        console.error('Error loading timer state:', err)
      }
    }
    
    loadTimerState()
  }, [])

  // Actualizar timer cada segundo
  useEffect(() => {
    if (!isRunning || isPaused || !startTime) return

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      setElapsedSeconds(Math.max(0, elapsed))
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, isPaused, startTime])

  const resetTimerState = useCallback(() => {
    setIsRunning(false)
    setIsPaused(false)
    setStartTime(null)
    setElapsedSeconds(0)
    setJobNumber('')
    setVehicleType('')
    setServiceType('')
    setObservation('')
    setEntryCompany(null)
  }, [])

  const activeCompany: CompanyId = (isRunning || isPaused) ? (entryCompany ?? company) : company
  const overtimeRules = COMPANIES[activeCompany].overtime

  const handleStart = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      await requestWakeLock()
      
      const res = await fetch('/api/timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime: new Date().toISOString(), company })
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Error al iniciar')
        await releaseWakeLock()
        return
      }
            
      const newStartTime = new Date()
      setIsRunning(true)
      setIsPaused(false)
      setStartTime(newStartTime)
      setElapsedSeconds(0)
      setJobNumber('')
      setVehicleType('')
      setServiceType('')
      setObservation(data.data?.entry?.observation ?? '')
      setEntryCompany(company)
      startBackgroundTimer(newStartTime.toISOString())
      onCompanyChange?.()
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [requestWakeLock, releaseWakeLock, startBackgroundTimer, company, onCompanyChange])

  const handleStop = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/timer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime: new Date().toISOString(), jobNumber, vehicle: vehicleType, observation, company: activeCompany })
      })
      const data = await res.json()

      if (data.success) {
        const savedJobNumber = jobNumber
        const savedVehicle = vehicleType
        const savedCompany = activeCompany
        const finalDuration = elapsedSeconds
        // El servidor ya aplicó la tarifa (y el overtime de Tecnofuel)
        const finalEarnings = data.data?.entry?.calculatedAmount ?? (elapsedSeconds / 3600) * hourlyRate
                
        resetTimerState()
        stopBackgroundTimer()
        await releaseWakeLock()
        
        setResult({
          duration: finalDuration,
          earnings: finalEarnings,
          jobNumber: savedJobNumber || data.data.entry?.jobNumber,
          vehicle: savedVehicle || data.data.entry?.vehicle,
          company: savedCompany
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
  }, [onTimerStop, stopBackgroundTimer, releaseWakeLock, jobNumber, vehicleType, observation, elapsedSeconds, hourlyRate, resetTimerState, activeCompany])

  const handlePause = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      })
      const data = await res.json()
      if (data.success) {
        setIsPaused(true)
        setIsRunning(false)
        // freeze elapsed at accumulated seconds returned from server
        if (data.data?.accumulatedSeconds !== undefined) {
          setElapsedSeconds(data.data.accumulatedSeconds)
          setStartTime(null)
        }
      } else {
        setError(data.error || 'Error al pausar')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleResume = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      })
      const data = await res.json()
      if (data.success) {
        const accumulated = data.data?.accumulatedSeconds ?? elapsedSeconds
        const newStartTime = new Date(Date.now() - accumulated * 1000)
        setIsPaused(false)
        setIsRunning(true)
        setStartTime(newStartTime)
      } else {
        setError(data.error || 'Error al reanudar')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [elapsedSeconds])

  const currentEarnings = overtimeRules
    ? overtimeAmount(tecnofuelPriorSeconds, elapsedSeconds, overtimeRules)
    : (elapsedSeconds / 3600) * hourlyRate

  function getTimerColor() {
    if (isRunning) return 'text-[#37352f]'
    if (isPaused) return 'text-[rgba(55,53,47,0.55)]'
    return 'text-[rgba(55,53,47,0.3)]'
  }

  function getEarningsColor() {
    if (isRunning) return 'text-[#37352f]'
    if (isPaused) return 'text-[rgba(55,53,47,0.55)]'
    return 'text-[rgba(55,53,47,0.25)]'
  }

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
        body: JSON.stringify({ observation: observationInput, company: activeCompany })
      })
      const data = await res.json()
      if (data.success) {
        // El servidor mantiene la etiqueta de la compañía en la nota
        setObservation(data.data?.entry?.observation ?? observationInput)
        setIsEditingObservation(false)
      } else {
        setError(data.error || 'Error al guardar comentario')
      }
    } catch (err) {
      console.error('Error saving observation:', err)
      setError('Error de conexión')
    }
  }, [observationInput, activeCompany])

  const handleSelectCompany = useCallback(async (target: CompanyId) => {
    if (target === activeCompany) return
    setError(null)
    try {
      const res = await fetch('/api/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: target })
      })
      const data = await res.json()
      if (data.success) {
        setEntryCompany(target)
        setObservation(data.data?.entry?.observation ?? '')
        onCompanyChange?.()
      } else {
        setError(data.error || 'Error al cambiar la compañía')
      }
    } catch (err) {
      console.error('Error switching company:', err)
      setError('Error de conexión')
    }
  }, [activeCompany, onCompanyChange])

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

  const handleSelectServiceType = async (selected: string) => {
    const newValue = serviceType === selected ? '' : selected
    setServiceType(newValue)
    try {
      await fetch('/api/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: newValue })
      })
    } catch (err) {
      console.error('Error saving service type:', err)
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
    if ((!isRunning && !isPaused) || !startTime) return null
    return (
      <div className="text-[12px] text-[#787774] mt-1">
        Iniciado: {formatTimeInFlorida(startTime)}
      </div>
    )
  }

  const renderCompanySection = () => {
    if (!isRunning && !isPaused) return null
    return (
      <div className="rounded-[6px] border border-[rgba(55,53,47,0.09)] p-3">
        <div className="flex items-center gap-2 text-[#787774] mb-2.5">
          <Building2 className="h-3.5 w-3.5" />
          <span className="text-[13px]">Compañía</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {COMPANY_IDS.map((id) => (
            <button
              type="button"
              key={id}
              onClick={() => handleSelectCompany(id)}
              className={"px-2 py-2 rounded-[4px] text-[13px] transition-colors touch-manipulation " + (activeCompany === id ? 'bg-[#37352f] text-white' : 'bg-transparent text-[#37352f] border border-[rgba(55,53,47,0.16)] hover:bg-[rgba(55,53,47,0.06)]')}
            >
              {COMPANIES[id].name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderJobNumberSection = () => {
    if (!isRunning && !isPaused) return null
    if (!COMPANIES[activeCompany].tracksJobDetails) return null
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
    if (!isRunning && !isPaused) return null
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
    if (!isRunning && !isPaused) return null
    if (!COMPANIES[activeCompany].tracksJobDetails) return null
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

  const renderServiceTypeSection = () => {
    if (!isRunning && !isPaused) return null
    if (!COMPANIES[activeCompany].tracksJobDetails) return null
    const SERVICE_OPTIONS = [
      { value: 'hourly', label: 'Hourly' },
      { value: 'point-to-point', label: 'Point to Point' },
    ]
    return (
      <div className="rounded-[6px] border border-[rgba(55,53,47,0.09)] p-3">
        <div className="flex items-center gap-2 text-[#787774] mb-2.5">
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span className="text-[13px]">Tipo de servicio</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {SERVICE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => handleSelectServiceType(option.value)}
              className={"px-2 py-2 rounded-[4px] text-[13px] transition-colors touch-manipulation " + (serviceType === option.value ? 'bg-[#37352f] text-white' : 'bg-transparent text-[#37352f] border border-[rgba(55,53,47,0.16)] hover:bg-[rgba(55,53,47,0.06)]')}
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
        {result.company === 'tecnofuel' && (
          <div className="flex items-center justify-center mb-3">
            <span className="px-2 py-1 bg-[#fbecdd] text-[#9a4a0b] text-[12px] font-semibold rounded-[4px]">Tecnofuel</span>
          </div>
        )}
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
    if (overtimeRules) {
      const thresholdSeconds = overtimeRules.thresholdHours * 3600
      const weekSeconds = tecnofuelPriorSeconds + ((isRunning || isPaused) ? elapsedSeconds : 0)
      const remaining = thresholdSeconds - weekSeconds
      return (
        <div className="text-[12px] text-[#787774] space-y-0.5">
          <div>
            {COMPANIES[activeCompany].name}: ${overtimeRules.baseRate}/hora · después de {overtimeRules.thresholdHours} h: ${overtimeRules.baseRate * overtimeRules.multiplier}/hora
          </div>
          <div className={remaining > 0 ? '' : 'font-semibold text-[#9a4a0b]'}>
            Semana: {(weekSeconds / 3600).toFixed(2)} h ·{' '}
            {remaining > 0
              ? `faltan ${(remaining / 3600).toFixed(2)} h para overtime`
              : `${(-remaining / 3600).toFixed(2)} h en overtime`}
          </div>
        </div>
      )
    }
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

  const renderButtons = () => {
    if (isRunning) {
      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePause}
            disabled={isLoading}
            className="flex-1 py-3 text-[15px] font-semibold bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white rounded-[6px] transition-colors flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99]"
          >
            <Pause className="h-4 w-4" />
            {isLoading ? '...' : 'PAUSAR'}
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={isLoading}
            className="flex-1 py-3 text-[15px] font-semibold bg-[#37352f] hover:bg-[#2f2d28] disabled:opacity-60 text-white rounded-[6px] transition-colors flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99]"
          >
            <Square className="h-4 w-4" />
            {isLoading ? 'Deteniendo...' : 'DETENER'}
          </button>
        </div>
      )
    }
    if (isPaused) {
      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleResume}
            disabled={isLoading}
            className="flex-1 py-3 text-[15px] font-semibold bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-60 text-white rounded-[6px] transition-colors flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99]"
          >
            <Play className="h-4 w-4" />
            {isLoading ? '...' : 'CONTINUAR'}
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={isLoading}
            className="flex-1 py-3 text-[15px] font-semibold bg-[#37352f] hover:bg-[#2f2d28] disabled:opacity-60 text-white rounded-[6px] transition-colors flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99]"
          >
            <Square className="h-4 w-4" />
            {isLoading ? 'Deteniendo...' : 'DETENER'}
          </button>
        </div>
      )
    }
    return (
      <button
        type="button"
        onClick={handleStart}
        disabled={isLoading}
        className="w-full py-3 text-[15px] font-semibold bg-[#37352f] hover:bg-[#2f2d28] disabled:opacity-60 text-white rounded-[6px] transition-colors flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99]"
      >
        <Play className="h-4 w-4" />
        {isLoading ? 'Iniciando...' : 'INICIAR'}
      </button>
    )
  }

  return (
    <div className="w-full rounded-[6px] border border-[rgba(55,53,47,0.09)] bg-white overflow-hidden">
      <div className="space-y-3 px-4 pt-5 pb-5">
        {/* Timer Display */}
        <div className="text-center py-4">
          <div className={`text-[56px] sm:text-[72px] font-mono font-bold tracking-tight transition-colors ${getTimerColor()}`}>
            {formatDuration(elapsedSeconds)}
          </div>
          {isPaused && (
            <div className="text-[12px] text-[#b45309] bg-[#fef3c7] border border-[#fde68a] px-3 py-1 rounded-full inline-block mt-1 font-medium">
              En pausa
            </div>
          )}
          <div className={`text-[22px] sm:text-[28px] mt-1 font-semibold transition-colors ${getEarningsColor()}`}>
            {formatCurrency(currentEarnings)}
          </div>
          {renderStartTimeIndicator()}
          {renderBackgroundIndicator()}
          {!isRunning && !isPaused && (
            <div className="text-[12px] text-[#787774] mt-1">
              Próximo trabajo: <span className="font-semibold text-[#37352f]">{COMPANIES[company].name}</span>
            </div>
          )}
        </div>

        {renderCompanySection()}
        {renderJobNumberSection()}
        {renderVehicleSection()}
        {renderServiceTypeSection()}
        {renderObservationSection()}
        {renderResultSection()}

        {/* Error Message */}
        {error && (
          <div className="text-[13px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] py-2 px-3 rounded-[4px]">{error}</div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {renderButtons()}
        </div>

        {/* Rate Info */}
        <div className="text-center pt-1">
          {renderRateEditor()}
        </div>
      </div>
    </div>
  )
}
