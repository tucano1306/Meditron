'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Clock, Smartphone, Settings, Hash, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, HOURLY_RATE, formatTimeInFlorida } from '@/lib/utils'
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
          if (data.data.isRunning && data.data.elapsedSeconds !== undefined) {
            // Reconstruir startTime basado en elapsedSeconds del servidor
            const reconstructedStartTime = new Date(Date.now() - (data.data.elapsedSeconds * 1000))
            setStartTime(reconstructedStartTime)
            setElapsedSeconds(data.data.elapsedSeconds)
          } else {
            setElapsedSeconds(0)
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
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
        setElapsedSeconds(Math.max(0, elapsed))
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
      
      // Enviar la hora UTC del cliente
      const now = new Date()
      const clientTime = now.toISOString()
      
      const res = await fetch('/api/timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime })
      })
      const data = await res.json()

      if (data.success) {
        setIsRunning(true)
        // Usar la hora actual del cliente como startTime para evitar desfases
        const newStartTime = new Date()
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
      // Enviar la hora UTC del cliente
      const now = new Date()
      const clientTime = now.toISOString()
      
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
        {isRunning && wakeLockActive && (
          <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 mt-2">
            <Smartphone className="h-3 w-3 animate-pulse" />
            <span>Modo background activo</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-6">
        {/* Timer Display - NÚMEROS MÁS GRANDES */}
        <div className="text-center py-4 sm:py-6">
          <div className={`text-5xl sm:text-7xl md:text-8xl font-mono font-black tracking-tight transition-all duration-300 ${
            isRunning 
              ? 'text-emerald-600 scale-105' 
              : 'text-gray-400'
          }`} style={{ textShadow: isRunning ? '0 4px 20px rgba(16, 185, 129, 0.3)' : 'none' }}>
            {formatDuration(elapsedSeconds)}
          </div>
          <div className={`text-2xl sm:text-3xl mt-3 font-bold transition-colors ${
            isRunning ? 'text-green-500' : 'text-gray-300'
          }`}>
            {formatCurrency(currentEarnings)}
          </div>
          {isRunning && startTime && (
            <div className="text-xs sm:text-sm text-gray-400 mt-2 font-medium">
              ⏱️ Iniciado: {formatTimeInFlorida(startTime)}
            </div>
          )}
        </div>

        {/* Job Number - Solo visible cuando está corriendo */}
        {isRunning && (
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
                  <Button
                    size="sm"
                    onClick={handleSaveJobNumber}
                    className="h-9 px-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                  >
                    OK
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEditJobNumber}
                    className="h-9 px-2"
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <button
                  onClick={handleEditJobNumber}
                  className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 transition-all"
                >
                  {jobNumber ? (
                    <span className="font-mono text-xl font-black text-emerald-700">{jobNumber}</span>
                  ) : (
                    <span className="text-gray-400 text-sm">Toca para asignar</span>
                  )}
                  <Pencil className="h-4 w-4 text-emerald-500" />
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
        <div className="flex justify-center">
          {isRunning ? (
            <Button
              onClick={handleStop}
              disabled={isLoading}
              className="w-full max-w-[280px] py-6 sm:py-8 text-lg sm:text-xl font-bold bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-2xl shadow-xl shadow-red-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Square className="mr-3 h-6 w-6 sm:h-7 sm:w-7" />
              {isLoading ? 'Deteniendo...' : 'DETENER'}
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={isLoading}
              className="w-full max-w-[280px] py-6 sm:py-8 text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-2xl shadow-xl shadow-emerald-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="mr-3 h-6 w-6 sm:h-7 sm:w-7" />
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
