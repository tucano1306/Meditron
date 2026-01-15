'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Clock, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, HOURLY_RATE } from '@/lib/utils'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { useWakeLock } from '@/hooks/useWakeLock'
import type { TimerState } from '@/types'

interface TimerProps {
  readonly onTimerStop?: () => void
  readonly initialState?: TimerState
}

export function Timer({ onTimerStop, initialState }: Readonly<TimerProps>) {
  const [isRunning, setIsRunning] = useState(initialState?.isRunning || false)
  const [elapsedSeconds, setElapsedSeconds] = useState(initialState?.elapsedSeconds || 0)
  const [startTime, setStartTime] = useState<Date | null>(
    initialState?.startTime ? new Date(initialState.startTime) : null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
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
      
      const res = await fetch('/api/timer', {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        setIsRunning(true)
        const newStartTime = new Date(data.data.entry.startTime)
        setStartTime(newStartTime)
        setElapsedSeconds(0)
        
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
      const res = await fetch('/api/timer', {
        method: 'PUT'
      })
      const data = await res.json()

      if (data.success) {
        setIsRunning(false)
        setStartTime(null)
        
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

  const currentEarnings = (elapsedSeconds / 3600) * HOURLY_RATE

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

        {/* Rate Info */}
        <div className="text-center text-xs sm:text-sm text-gray-400">
          Tarifa: ${HOURLY_RATE}/hora
        </div>
      </CardContent>
    </Card>
  )
}
