'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Clock, Smartphone, Settings, Hash, Pencil, Bus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, HOURLY_RATE, formatTimeInFlorida } from '@/lib/utils'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { useWakeLock } from '@/hooks/useWakeLock'
import type { TimerState } from '@/types'

const VEHICLE_OPTIONS = [
  { value: 'sprinter', label: 'Sprinter' },
  { value: 'mini-bus', label: 'Mini Bus' },
  { value: 'motorcoach', label: 'Motorcoach' },
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
        body: JSON.stringify({ clientTime: new Date().toISOString(), jobNumber, vehicle: vehicleType })
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
  }, [onTimerStop, stopBackgroundTimer, releaseWakeLock, jobNumber, vehicleType, elapsedSeconds, hourlyRate, resetTimerState])

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

  // Sub-componentes extraídos para reducir complejidad cognitiva
  const renderBackgroundIndicator = () => {
    if (!isRunning || !wakeLockActive) return null
    return (
      <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 mt-2">
        <Smartphone className="h-3 w-3 animate-pulse" />
        <span>Modo background activo</span>
      </div>
    )
  }

  const renderStartTimeIndicator = () => {
    if (!isRunning || !startTime) return null
    return (
      <div className="text-xs sm:text-sm text-gray-400 mt-2 font-medium">
        ⏱️ Iniciado: {formatTimeInFlorida(startTime)}
      </div>
    )
  }

  const renderJobNumberSection = () => {
    if (!isRunning) return null
    return (
      <div className="bg-gradient-to-r from-gray-50 to-emerald-50/30 rounded-2xl p-4 border border-emerald-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Hash className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-sm font-semibold">Trabajo #</span>
          </div>
          {isEditingJobNumber ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={jobNumberInput}
                onChange={(e) => setJobNumberInput(e.target.value)}
                placeholder="Ej: 12345"
                className="w-28 px-3 py-2 text-lg font-mono font-bold rounded-xl border-2 border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-center"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveJobNumber} className="h-9 px-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl">OK</Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEditJobNumber} className="h-9 px-2">✕</Button>
            </div>
          ) : (
            <button onClick={handleEditJobNumber} className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 transition-all">
              <span className={jobNumber ? "font-mono text-xl font-black text-emerald-700" : "text-gray-400 text-sm"}>
                {jobNumber || 'Toca para asignar'}
              </span>
              <Pencil className="h-4 w-4 text-emerald-500" />
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderVehicleSection = () => {
    if (!isRunning) return null
    return (
      <div className="bg-gradient-to-r from-gray-50 to-blue-50/30 rounded-2xl p-4 border border-blue-100">
        <div className="flex items-center gap-2 text-gray-600 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Bus className="h-4 w-4 text-blue-600" />
          </div>
          <span className="text-sm font-semibold">Vehículo</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {VEHICLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelectVehicle(option.value)}
              className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                vehicleType === option.value
                  ? 'bg-blue-600 text-white shadow-md scale-[1.02]'
                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
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
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
        <div className="flex items-center justify-center gap-2 text-green-600 mb-3">
          <Clock className="h-5 w-5" />
          <span className="font-medium">¡Turno Completado!</span>
        </div>
        {(result.jobNumber ?? result.vehicle) && (
          <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
            {result.jobNumber && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-sm font-bold rounded-full">#{result.jobNumber}</span>}
            {result.vehicle && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full flex items-center gap-1"><Bus className="h-3 w-3" />{getVehicleLabel(result.vehicle)}</span>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div><div className="text-sm text-gray-500">Duración</div><div className="text-xl font-bold text-gray-900">{formatDuration(result.duration)}</div></div>
          <div><div className="text-sm text-gray-500">Ganado</div><div className="text-xl font-bold text-green-600">{formatCurrency(result.earnings)}</div></div>
        </div>
      </div>
    )
  }

  const renderRateEditor = () => {
    if (!isEditingRate) {
      return (
        <button onClick={handleStartRateEdit} className="text-xs sm:text-sm text-gray-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-1 mx-auto">
          <Settings className="h-3 w-3" />
          Tarifa: ${hourlyRate}/hora
        </button>
      )
    }
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="text-gray-500">$</span>
        <input type="number" value={tempRate} onChange={(e) => setTempRate(e.target.value)} className="w-20 px-2 py-1 text-center border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" step="0.01" min="0" />
        <span className="text-gray-500">/hora</span>
        <Button size="sm" variant="ghost" onClick={handleSaveRate} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">✓</Button>
        <Button size="sm" variant="ghost" onClick={handleCancelRateEdit} className="text-gray-400 hover:text-gray-600">✕</Button>
      </div>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto border-0 shadow-2xl bg-gradient-to-br from-white via-white to-emerald-50/50 overflow-hidden">
      <CardHeader className="text-center pb-2 sm:pb-4 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-green-500/5" />
        <CardTitle className="flex items-center justify-center gap-2 text-lg sm:text-xl font-bold relative">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-200">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
            Control de Horas
          </span>
        </CardTitle>
        {renderBackgroundIndicator()}
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-6">
        {/* Timer Display */}
        <div className="text-center py-4 sm:py-6">
          <div className={`text-5xl sm:text-7xl md:text-8xl font-mono font-black tracking-tight transition-all duration-300 ${isRunning ? 'text-emerald-600 scale-105' : 'text-gray-400'}`} style={{ textShadow: isRunning ? '0 4px 20px rgba(16, 185, 129, 0.3)' : 'none' }}>
            {formatDuration(elapsedSeconds)}
          </div>
          <div className={`text-2xl sm:text-3xl mt-3 font-bold transition-colors ${isRunning ? 'text-green-500' : 'text-gray-300'}`}>
            {formatCurrency(currentEarnings)}
          </div>
          {renderStartTimeIndicator()}
        </div>

        {renderJobNumberSection()}
        {renderVehicleSection()}
        {renderResultSection()}

        {/* Error Message */}
        {error && <div className="text-center text-red-500 text-sm bg-red-50 py-2 px-4 rounded-xl">{error}</div>}

        {/* Buttons */}
        <div className="flex justify-center">
          {isRunning ? (
            <Button onClick={handleStop} disabled={isLoading} className="w-full max-w-[280px] py-6 sm:py-8 text-lg sm:text-xl font-bold bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-2xl shadow-xl shadow-red-200 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Square className="mr-3 h-6 w-6 sm:h-7 sm:w-7" />
              {isLoading ? 'Deteniendo...' : 'DETENER'}
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={isLoading} className="w-full max-w-[280px] py-6 sm:py-8 text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-2xl shadow-xl shadow-emerald-200 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Play className="mr-3 h-6 w-6 sm:h-7 sm:w-7" />
              {isLoading ? 'Iniciando...' : 'INICIAR'}
            </Button>
          )}
        </div>

        {/* Rate Info */}
        <div className="text-center">
          {renderRateEditor()}
        </div>
      </CardContent>
    </Card>
  )
}
