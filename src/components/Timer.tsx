'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, HOURLY_RATE } from '@/lib/utils'
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
      const res = await fetch('/api/timer', {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        setIsRunning(true)
        setStartTime(new Date(data.data.entry.startTime))
        setElapsedSeconds(0)
      } else {
        setError(data.error || 'Error al iniciar')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

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
  }, [onTimerStop])

  const currentEarnings = (elapsedSeconds / 3600) * HOURLY_RATE

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-2xl">
          <Clock className="h-6 w-6" />
          Control de Horas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timer Display */}
        <div className="text-center">
          <div className={`text-6xl font-mono font-bold ${isRunning ? 'text-green-600' : 'text-gray-600'}`}>
            {formatDuration(elapsedSeconds)}
          </div>
          <div className="text-xl text-gray-500 mt-2">
            {formatCurrency(currentEarnings)}
          </div>
          {isRunning && startTime && (
            <div className="text-sm text-gray-400 mt-1">
              Iniciado: {startTime.toLocaleTimeString('es-ES')}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-center text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-center gap-4">
          {isRunning ? (
            <Button
              onClick={handleStop}
              disabled={isLoading}
              variant="destructive"
              size="xl"
              className="min-w-[200px]"
            >
              <Square className="mr-2 h-6 w-6" />
              {isLoading ? 'Deteniendo...' : 'DETENER'}
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={isLoading}
              variant="success"
              size="xl"
              className="min-w-[200px]"
            >
              <Play className="mr-2 h-6 w-6" />
              {isLoading ? 'Iniciando...' : 'INICIAR'}
            </Button>
          )}
        </div>

        {/* Rate Info */}
        <div className="text-center text-sm text-gray-400">
          Tarifa: ${HOURLY_RATE}/hora
        </div>
      </CardContent>
    </Card>
  )
}
