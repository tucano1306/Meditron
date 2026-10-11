'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Pause, Clock, Smartphone, Settings, Hash, Pencil, Bus, MessageSquare, ArrowLeftRight, Repeat, ArrowRightLeft, Check, Undo2, History } from 'lucide-react'
import { formatDuration, formatCurrency, HOURLY_RATE, getFloridaDateString } from '@/lib/utils'
import { describeRule, overtimeAmount, ruleFor, type Company, type OvertimeRules } from '@/lib/companies'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { useWakeLock } from '@/hooks/useWakeLock'
import type { TimerState } from '@/types'
import { formatTime12 } from '@/lib/report-format'
import { formatHM } from '@/lib/display'
import { StartTimePicker } from './StartTimePicker'

const VEHICLE_OPTIONS = [
  { value: 'sprinter', label: 'Sprinter', short: 'Sprinter' },
  { value: 'mini-bus', label: 'Mini Bus', short: 'Mini Bus' },
  { value: 'motorcoach', label: 'Motorcoach', short: 'Motor C.' },
]

function getVehicleLabel(value: string): string {
  const vehicle = VEHICLE_OPTIONS.find(v => v.value === value)
  return vehicle ? vehicle.label : value
}

/** Aviso tras una acción del turno; `undo` permite revertirla */
interface Notice {
  text: string
  undo?: { kind: 'move'; company: string } | { kind: 'start'; start: Date }
}

interface TimerProps {
  readonly onTimerStop?: () => void
  readonly initialState?: TimerState
  readonly hourlyRate?: number
  readonly onRateChange?: (newRate: number) => void
  /** Compañías del usuario */
  readonly companies?: Company[]
  /** Compañía que se está viendo: con ella se inicia el próximo trabajo (vacío = la por defecto) */
  readonly company?: string
  /** Horas ya cerradas en el grupo de overtime actual (semana o día) de la compañía vista */
  readonly overtime?: { kind: 'week' | 'day' | 'entry'; completedSeconds: number; rules: OvertimeRules | null }
  /** Avisa cuando cambia la compañía del trabajo en curso (al iniciarlo o al cambiarla) */
  readonly onCompanyChange?: () => void
  /** Pide a la página mostrar otra compañía (p. ej. la del turno en curso) */
  readonly onSwitchView?: (companyId: string) => void
  /** Guarda una nueva tarifa por hora para la compañía vista; devuelve un error o null */
  readonly onSaveRate?: (rate: number) => Promise<string | null>
}

export function Timer({ onTimerStop, initialState, hourlyRate = HOURLY_RATE, onRateChange, companies = [], company = '', overtime, onCompanyChange, onSwitchView, onSaveRate }: Readonly<TimerProps>) {
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
  const [result, setResult] = useState<{ duration: number; earnings: number; jobNumber?: string; vehicle?: string; company?: string } | null>(null)
  // Compañía del trabajo en curso (sale de su nota); sin trabajo en curso manda la vista elegida
  const [entryCompany, setEntryCompany] = useState<string | null>(null)
  // Confirmación de "cambiar de trabajo" (detener el turno de una compañía y empezar el de la otra)
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  // Aviso de la última acción (mover turno, iniciar o ajustar la hora), con deshacer
  const [notice, setNotice] = useState<Notice | null>(null)
  // Elegir la hora de inicio: se olvidó iniciar ("start") o corregir el turno en curso ("adjust")
  const [picker, setPicker] = useState<'start' | 'adjust' | null>(null)
  // Inicio real del turno en curso (startTime es el inicio "virtual" que descuenta pausas)
  const [entryStart, setEntryStart] = useState<Date | null>(
    initialState?.startTime ? new Date(initialState.startTime) : null
  )
  // Fin del último turno: el siguiente no puede empezar antes
  const [lastEnd, setLastEnd] = useState<Date | null>(null)
  
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
        
        if (typeof data.data.companyId === 'string') setEntryCompany(data.data.companyId)
        setEntryStart((running || paused) && data.data.startTime ? new Date(data.data.startTime) : null)
        setLastEnd(data.data.lastEndTime ? new Date(data.data.lastEndTime) : null)
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
    setEntryStart(null)
    setPicker(null)
  }, [])

  const activeCompany: string = (isRunning || isPaused) ? (entryCompany ?? company) : company
  const companyOf = (id: string) => companies.find(c => c.id === id)
  const nameOf = (id: string) => companyOf(id)?.name ?? 'Compañía'
  const activeConfig = companyOf(activeCompany)
  // El overtime en vivo usa las horas ya cerradas de la compañía vista
  const overtimeRules = activeCompany === company ? overtime?.rules ?? null : null
  const priorSeconds = overtime?.completedSeconds ?? 0
  const activeRate = activeConfig ? ruleFor(activeConfig, getFloridaDateString()).hourlyRate : hourlyRate

  // `startAt`: se olvidó iniciar el cronómetro y empieza desde una hora anterior
  const handleStart = useCallback(async (target: string = company, startAt?: Date) => {
    setIsLoading(true)
    setError(null)

    try {
      await requestWakeLock()
      
      const res = await fetch('/api/timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime: new Date().toISOString(), companyId: target, startTime: startAt?.toISOString() })
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Error al iniciar')
        await releaseWakeLock()
        return
      }
            
      const newStartTime = startAt ?? new Date()
      const elapsed = Math.max(0, Math.floor((Date.now() - newStartTime.getTime()) / 1000))
      setIsRunning(true)
      setIsPaused(false)
      setStartTime(newStartTime)
      setEntryStart(newStartTime)
      setElapsedSeconds(elapsed)
      setPicker(null)
      setNotice(startAt ? { text: `Iniciado desde las ${formatTime12(newStartTime)}: ya llevas ${formatHM(elapsed)}` } : null)
      setJobNumber('')
      setVehicleType('')
      setServiceType('')
      setObservation(data.data?.entry?.observation ?? '')
      setEntryCompany(target)
      setResult(null)
      startBackgroundTimer(newStartTime.toISOString())
      onCompanyChange?.()
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [requestWakeLock, releaseWakeLock, startBackgroundTimer, company, onCompanyChange])

  const handleStop = useCallback(async (): Promise<boolean> => {
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
        const savedCompany = activeCompany
        const finalDuration = elapsedSeconds
        // El servidor ya aplicó la tarifa (y el overtime de Tecnofuel)
        const finalEarnings = data.data?.entry?.calculatedAmount ?? (elapsedSeconds / 3600) * activeRate
                
        resetTimerState()
        setLastEnd(new Date())
        setNotice(null)
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
        return true
      }
      setError(data.error || 'Error al detener')
      return false
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [onTimerStop, stopBackgroundTimer, releaseWakeLock, jobNumber, vehicleType, observation, elapsedSeconds, activeRate, resetTimerState, activeCompany])

  // Cambiar de trabajo: cierra el turno de la otra compañía y empieza uno de la vista actual
  const handleSwitchJob = useCallback(async () => {
    setConfirmSwitch(false)
    if (await handleStop()) {
      await handleStart(company)
    }
  }, [handleStop, handleStart, company])

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
    ? overtimeAmount(priorSeconds, elapsedSeconds, overtimeRules)
    : (elapsedSeconds / 3600) * activeRate

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

  // Mueve el turno en curso a otra compañía: conserva el tiempo, el número de
  // trabajo, el vehículo, el servicio y el comentario (solo cambia la compañía)
  const handleMoveEntry = useCallback(async (target: string, isUndo = false) => {
    if (target === activeCompany) return
    const from = activeCompany
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: target })
      })
      const data = await res.json()
      if (data.success) {
        setEntryCompany(target)
        setConfirmSwitch(false)
        const targetName = companies.find(c => c.id === target)?.name ?? 'la otra compañía'
        setNotice(isUndo ? null : { text: `Turno movido a ${targetName} con su tiempo y sus datos`, undo: { kind: 'move', company: from } })
        onCompanyChange?.()
        onSwitchView?.(target)
      } else {
        setError(data.error || 'Error al mover el turno')
      }
    } catch (err) {
      console.error('Error moving entry:', err)
      setError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }, [activeCompany, companies, onCompanyChange, onSwitchView])

  // Corrige la hora de inicio del turno en curso (se inició tarde o antes de tiempo)
  const handleAdjustStart = useCallback(async (newStart: Date, isUndo = false) => {
    const previous = entryStart
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setStart', startTime: newStart.toISOString() })
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'No se pudo ajustar la hora de inicio')
        return
      }
      const elapsed: number = data.data.elapsedSeconds
      setElapsedSeconds(elapsed)
      if (!data.data.isPaused) {
        const virtualStart = new Date(Date.now() - elapsed * 1000)
        setStartTime(virtualStart)
        startBackgroundTimer(virtualStart.toISOString())
      }
      setEntryStart(new Date(data.data.startTime))
      setPicker(null)
      setNotice(isUndo || !previous ? null : {
        text: `Inicio ajustado a las ${formatTime12(newStart)}: llevas ${formatHM(elapsed)}`,
        undo: { kind: 'start', start: previous },
      })
      onCompanyChange?.()
    } catch (err) {
      console.error('Error adjusting start:', err)
      setError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }, [entryStart, startBackgroundTimer, onCompanyChange])

  const handleUndo = useCallback(() => {
    if (!notice?.undo) return
    if (notice.undo.kind === 'move') handleMoveEntry(notice.undo.company, true)
    else handleAdjustStart(notice.undo.start, true)
  }, [notice, handleMoveEntry, handleAdjustStart])

  // Los avisos se van solos
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 10000)
    return () => clearTimeout(id)
  }, [notice])

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
    
    if (onSaveRate) {
      const saveError = await onSaveRate(newRate)
      if (saveError) {
        setError(saveError)
      } else {
        setIsEditingRate(false)
        onRateChange?.(newRate)
      }
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
  }, [tempRate, onRateChange, onSaveRate])

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
    const shown = entryStart ?? startTime
    if ((!isRunning && !isPaused) || !shown) return null
    return (
      <button
        type="button"
        onClick={() => { setError(null); setPicker(picker === 'adjust' ? null : 'adjust') }}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-[#787774] hover:bg-[rgba(55,53,47,0.08)] hover:text-[#37352f] transition-colors touch-manipulation"
      >
        Iniciado: {formatTime12(shown)}
        <span className="inline-flex items-center gap-0.5 font-semibold text-[#37352f]">
          <Pencil className="h-3 w-3" />
          Ajustar
        </span>
      </button>
    )
  }

  const renderJobNumberSection = () => {
    if (!isRunning && !isPaused) return null
    // Con dato se muestra siempre: al mover el turno a una compañía que no lo
    // registra no debe desaparecer
    if (!activeConfig?.trackJobNumber && !jobNumber) return null
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
    if (!activeConfig?.trackVehicle && !vehicleType) return null
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
    if (!activeConfig?.trackServiceType && !serviceType) return null
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
    if (result.company && result.company !== company) return null
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
    if (overtimeRules && activeConfig) {
      const thresholdSeconds = overtimeRules.thresholdHours * 3600
      const periodSeconds = priorSeconds + ((isRunning || isPaused) ? elapsedSeconds : 0)
      const remaining = thresholdSeconds - periodSeconds
      return (
        <div className="text-[12px] text-[#787774] space-y-0.5">
          <div>{describeRule(ruleFor(activeConfig, getFloridaDateString()))}</div>
          <div className={remaining > 0 ? '' : 'font-semibold text-[#9a4a0b]'}>
            {overtime?.kind === 'day' ? 'Hoy' : 'Semana'}: {(periodSeconds / 3600).toFixed(2)} h ·{' '}
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
          Tarifa: ${activeRate}/hora
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
        onClick={() => handleStart()}
        disabled={isLoading}
        className="w-full py-3 text-[15px] font-semibold bg-[#37352f] hover:bg-[#2f2d28] disabled:opacity-60 text-white rounded-[6px] transition-colors flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99]"
      >
        <Play className="h-4 w-4" />
        {isLoading ? 'Iniciando...' : `INICIAR · ${nameOf(company)}`}
      </button>
    )
  }

  // Se olvidó iniciar el cronómetro: empezar desde la hora real del turno
  const renderForgotToStart = () => {
    if (isRunning || isPaused) return null
    if (picker === 'start') {
      return (
        <StartTimePicker
          mode="start"
          minStart={lastEnd}
          rate={activeRate}
          companyName={nameOf(company)}
          busy={isLoading}
          onConfirm={start => handleStart(company, start)}
          onCancel={() => setPicker(null)}
        />
      )
    }
    return (
      <button
        type="button"
        onClick={() => { setError(null); setPicker('start') }}
        className="flex flex-wrap items-center justify-center gap-x-1.5 py-1 text-[12px] text-[#787774] hover:text-[#37352f] transition-colors touch-manipulation"
      >
        <History className="h-3.5 w-3.5" />
        ¿Se te olvidó iniciarlo?
        <span className="font-semibold text-[#37352f] underline underline-offset-2">Empieza desde una hora anterior</span>
      </button>
    )
  }

  const renderAdjustPicker = () => {
    if (picker !== 'adjust' || (!isRunning && !isPaused)) return null
    return (
      <StartTimePicker
        mode="adjust"
        currentStart={entryStart ?? startTime}
        currentElapsed={elapsedSeconds}
        minStart={lastEnd}
        rate={activeRate}
        companyName={nameOf(activeCompany)}
        busy={isLoading}
        onConfirm={start => handleAdjustStart(start)}
        onCancel={() => setPicker(null)}
      />
    )
  }

  // Por si se inició en la compañía equivocada: mueve el turno sin perder nada
  const renderMoveEntryLink = () => {
    if (!isRunning && !isPaused) return null
    const others = companies.filter(c => !c.archived && c.id !== activeCompany)
    if (others.length === 0) return null
    return (
      <label className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-1 text-[12px] text-[#787774]">
        ¿Lo empezaste en otra compañía?
        <span className="relative inline-flex items-center gap-1 rounded-full border border-[rgba(55,53,47,0.16)] bg-white px-2.5 py-1 font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.06)] transition-colors">
          <ArrowRightLeft className="h-3 w-3" />
          Mover turno a…
          <select
            value=""
            disabled={isLoading}
            aria-label="Mover el turno a otra compañía"
            onChange={e => { if (e.target.value) handleMoveEntry(e.target.value) }}
            className="absolute inset-0 cursor-pointer opacity-0 touch-manipulation"
          >
            <option value="">Mover turno a…</option>
            {others.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </span>
      </label>
    )
  }

  const renderNotice = () => {
    if (!notice || (!isRunning && !isPaused)) return null
    return (
      <div className="flex items-center justify-between gap-2 rounded-[6px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900 animate-fade-in">
        <span className="flex items-center gap-1.5">
          <Check className="h-4 w-4 flex-shrink-0" />
          {notice.text}
        </span>
        {notice.undo && (
        <button
          type="button"
          onClick={handleUndo}
          disabled={isLoading}
          className="flex flex-shrink-0 items-center gap-1 rounded-[4px] px-2 py-1 font-semibold hover:bg-emerald-100 disabled:opacity-60 transition-colors"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Deshacer
        </button>
        )}
      </div>
    )
  }

  // La vista es de una compañía pero el turno en curso es de la otra: no se
  // muestra como propio; se ofrece verlo o cambiar de trabajo.
  if ((isRunning || isPaused) && entryCompany && entryCompany !== company) {
    const runningName = nameOf(entryCompany)
    const viewName = nameOf(company)
    return (
      <div className="w-full rounded-[6px] border border-[rgba(55,53,47,0.09)] bg-white overflow-hidden">
        <div className="space-y-3 px-4 py-5">
          <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-[#787774]">{viewName}</div>
          <div className="rounded-[6px] border border-emerald-300 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#37352f]">
              <span className={`h-2 w-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
              Turno de {runningName} {isPaused ? 'en pausa' : 'en curso'}
            </div>
            <div className="mt-1 text-[13px] text-[#37352f] font-mono">
              {formatDuration(elapsedSeconds)}
              {(entryStart ?? startTime) && <span className="font-sans text-[#787774]"> · iniciado {formatTime12((entryStart ?? startTime) as Date)}</span>}
            </div>
          </div>
          <p className="text-[13px] text-[#787774]">
            Solo puede haber un turno a la vez. ¿Qué quieres hacer?
          </p>
          {error && (
            <div className="text-[13px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] py-2 px-3 rounded-[4px]">{error}</div>
          )}
          {confirmSwitch ? (
            <div className="rounded-[6px] border border-[#37352f] p-3 space-y-2">
              <p className="text-[13px] text-[#37352f]">
                Se cierra el turno de {runningName} con {formatDuration(elapsedSeconds)} y empieza uno nuevo de {viewName} desde cero. ¿Continuar?
              </p>
              <p className="text-[12px] text-[#787774]">
                Si lo empezaste en la compañía equivocada, mejor usa «Mover este turno a {viewName}».
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSwitchJob}
                  disabled={isLoading}
                  className="flex-1 py-2.5 text-[14px] font-semibold bg-[#37352f] hover:bg-[#2f2d28] disabled:opacity-60 text-white rounded-[6px] transition-colors touch-manipulation"
                >
                  {isLoading ? 'Cambiando...' : 'Sí, terminar y empezar'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmSwitch(false)}
                  className="px-4 py-2.5 text-[14px] text-[#787774] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] rounded-[6px] transition-colors touch-manipulation"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleMoveEntry(company)}
                disabled={isLoading}
                className="w-full rounded-[6px] bg-[#37352f] px-4 py-3 text-left text-white transition-colors hover:bg-[#2f2d28] disabled:opacity-60 touch-manipulation active:scale-[0.99]"
              >
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <ArrowRightLeft className="h-4 w-4 flex-shrink-0" />
                  {isLoading ? 'Moviendo...' : `Mover este turno a ${viewName}`}
                </span>
                <span className="mt-0.5 block pl-6 text-[12px] text-white/70">
                  Lo empezaste en la compañía equivocada: el tiempo y los datos pasan a {viewName}.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmSwitch(true)}
                disabled={isLoading}
                className="w-full rounded-[6px] border border-[rgba(55,53,47,0.16)] px-4 py-3 text-left text-[#37352f] transition-colors hover:bg-[rgba(55,53,47,0.06)] disabled:opacity-60 touch-manipulation active:scale-[0.99]"
              >
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <Repeat className="h-4 w-4 flex-shrink-0" />
                  Terminar {runningName} y empezar {viewName}
                </span>
                <span className="mt-0.5 block pl-6 text-[12px] text-[#787774]">
                  Ya acabaste con {runningName}: cierra ese turno y empieza uno nuevo.
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSwitchView?.(entryCompany)}
                className="w-full py-2 text-[13px] font-semibold text-[#787774] hover:text-[#37352f] transition-colors touch-manipulation"
              >
                Ver turno de {runningName}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full rounded-[6px] border border-[rgba(55,53,47,0.09)] bg-white overflow-hidden">
      <div className="space-y-3 px-4 pt-5 pb-5">
        {/* Timer Display */}
        <div className="text-center py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#787774] mb-1">
            {nameOf(activeCompany)}
          </div>
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
        </div>

        {renderAdjustPicker()}
        {renderNotice()}
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
          {picker === 'start' ? null : renderButtons()}
          {renderForgotToStart()}
          {renderMoveEntryLink()}
        </div>

        {/* Rate Info */}
        <div className="text-center pt-1">
          {renderRateEditor()}
        </div>
      </div>
    </div>
  )
}
