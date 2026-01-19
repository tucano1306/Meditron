'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Clock, Smartphone, Settings, Hash, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, HOURLY_RATE } from '@/lib/utils'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { useWakeLock } from '@/hooks/useWakeLock'
import type { TimerState } from '@/types'

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
  
  // PWA and background support
  const { startBackgroundTimer, stopBackgroundTimer } = useServiceWorker()
  const { requestWakeLock, releaseWakeLock, isActive: wakeLockActive } = useWakeLock()

  // Cargar estado inicial
  useEffect(() => {
    async function loadTimerState() {
      try {
        const res = await fetch('/api/timer')
        const data = await res.json()
        
        if (data.success && data.data) {
          setIsRunning(data.data.isRunning)
          setElapsedSeconds(data.data.elapsedSeconds)
          if (data.data.startTime) {
            setStartTime(new Date(data.data.startTime))
          }
          if (data.data.jobNumber) {
            setJobNumber(data.data.jobNumber)
          }
        }
      } catch (err) {
        console.error('Error loading timer state:', err)
      }
    }
    
    loadTimerState()
  }, [])

  // Actualizar timer cada segundo
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isRunning && startTime) {
      interval = setInterval(() => {
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        setElapsedSeconds(elapsed)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, startTime])

  const handleStart = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Request wake lock to keep screen on
      await requestWakeLock()
      
      // Enviar la hora local del cliente (sin conversión a UTC)
      const now = new Date()
      const clientTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      
      const res = await fetch('/api/timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime })
      })
      const data = await res.json()

      if (data.success) {
        setIsRunning(true)
        const newStartTime = new Date(data.data.entry.startTime)
        setStartTime(newStartTime)
        setElapsedSeconds(0)
        setJobNumber('')
        
        // Start background timer
        startBackgroundTimer(newStartTime.toISOString())
      } else {
        setError(data.error || 'Error al iniciar')
        await releaseWakeLock()
      }
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
      // Enviar la hora local del cliente (sin conversión a UTC)
      const now = new Date()
      const clientTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      
      const res = await fetch('/api/timer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime, jobNumber })
      })
      const data = await res.json()

      if (data.success) {
        setIsRunning(false)
        setStartTime(null)
        setElapsedSeconds(0) // Reset counter to zero
        setJobNumber('')
        
        // Stop background timer and release wake lock
        stopBackgroundTimer()
        await releaseWakeLock()
        
        if (onTimerStop) {
          onTimerStop()
        }
      } else {
        setError(data.error || 'Error al detener')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [onTimerStop, stopBackgroundTimer, releaseWakeLock])

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

  const handleEditJobNumber = () => {
    setJobNumberInput(jobNumber)
    setIsEditingJobNumber(true)
  }

  const handleCancelEditJobNumber = () => {
    setIsEditingJobNumber(false)
    setJobNumberInput('')
  }

  const handleSaveRate = async () => {
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
  }

  return (
    <Card className="w-full max-w-md mx-auto border-0 shadow-xl shadow-emerald-100">
      <CardHeader className="text-center pb-2 sm:pb-4">
        <CardTitle className="flex items-center justify-center gap-2 text-xl sm:text-2xl">
          <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
          Control de Horas
        </CardTitle>
        {isRunning && wakeLockActive && (
          <div className="flex items-center justify-center gap-1 text-xs text-emerald-600">
            <Smartphone className="h-3 w-3" />
            <span>Modo background activo</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
        {/* Timer Display */}
        <div className="text-center">
          <div className={`text-4xl sm:text-6xl font-mono font-bold transition-colors ${
            isRunning ? 'text-emerald-600' : 'text-gray-600'
          }`}>
            {formatDuration(elapsedSeconds)}
          </div>
          <div className="text-lg sm:text-xl text-emerald-600 mt-2 font-medium">
            {formatCurrency(currentEarnings)}
          </div>
          {isRunning && startTime && (
            <div className="text-xs sm:text-sm text-gray-400 mt-1">
              Iniciado: {startTime.toLocaleTimeString('es-ES')}
            </div>
          )}
        </div>

        {/* Job Number - Solo visible cuando está corriendo */}
        {isRunning && (
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <Hash className="h-4 w-4" />
                <span className="text-sm font-medium">Trabajo #</span>
              </div>
              {isEditingJobNumber ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={jobNumberInput}
                    onChange={(e) => setJobNumberInput(e.target.value)}
                    placeholder="Ej: 12345"
                    className="w-24 px-2 py-1 text-sm rounded border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none font-mono"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveJobNumber}
                    className="h-7 px-2 text-xs bg-emerald-500 hover:bg-emerald-600"
                  >
                    OK
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEditJobNumber}
                    className="h-7 px-2 text-xs"
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <button
                  onClick={handleEditJobNumber}
                  className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  {jobNumber ? (
                    <span className="font-mono font-medium">{jobNumber}</span>
                  ) : (
                    <span className="text-gray-400 text-sm">Sin asignar</span>
                  )}
                  <Pencil className="h-3 w-3 ml-1" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="text-center text-red-500 text-sm bg-red-50 py-2 px-4 rounded-xl">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-center gap-4">
          {isRunning ? (
            <Button
              onClick={handleStop}
              disabled={isLoading}
              className="min-w-[160px] sm:min-w-[200px] py-4 sm:py-6 text-base sm:text-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl shadow-lg shadow-red-200"
            >
              <Square className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              {isLoading ? 'Deteniendo...' : 'DETENER'}
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={isLoading}
              className="min-w-[160px] sm:min-w-[200px] py-4 sm:py-6 text-base sm:text-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-200"
            >
              <Play className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              {isLoading ? 'Iniciando...' : 'INICIAR'}
            </Button>
          )}
        </div>

        {/* Rate Info - Editable */}
        <div className="text-center">
          {isEditingRate ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                value={tempRate}
                onChange={(e) => setTempRate(e.target.value)}
                className="w-20 px-2 py-1 text-center border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                step="0.01"
                min="0"
              />
              <span className="text-gray-500">/hora</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveRate}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              >
                ✓
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditingRate(false)
                  setTempRate(hourlyRate.toString())
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </Button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTempRate(hourlyRate.toString())
                setIsEditingRate(true)
              }}
              className="text-xs sm:text-sm text-gray-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
              <Settings className="h-3 w-3" />
              Tarifa: ${hourlyRate}/hora
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
