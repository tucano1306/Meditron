'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Clock, DollarSign, Check, Hash, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency } from '@/lib/utils'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { useWakeLock } from '@/hooks/useWakeLock'
import type { TimerState } from '@/types'

interface PaymentTimerProps {
  readonly onComplete?: () => void
  readonly initialState?: TimerState
}

export function PaymentTimer({ onComplete, initialState }: Readonly<PaymentTimerProps>) {
  const [isRunning, setIsRunning] = useState(initialState?.isRunning || false)
  const [elapsedSeconds, setElapsedSeconds] = useState(initialState?.elapsedSeconds || 0)
  const [startTime, setStartTime] = useState<Date | null>(
    initialState?.startTime ? new Date(initialState.startTime) : null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAmountModal, setShowAmountModal] = useState(false)
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState<{ amount: number; hourlyRate: number } | null>(null)
  const [jobNumber, setJobNumber] = useState('')
  const [isEditingJobNumber, setIsEditingJobNumber] = useState(false)
  const [jobNumberInput, setJobNumberInput] = useState('')
  
  const { startBackgroundTimer, stopBackgroundTimer } = useServiceWorker()
  const { requestWakeLock, releaseWakeLock, isActive: wakeLockActive } = useWakeLock()

  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch('/api/payment')
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
        console.error('Error loading state:', err)
      }
    }
    
    loadState()
  }, [])

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
    setResult(null)

    try {
      await requestWakeLock()
      
      // Enviar la hora del cliente (laptop) al servidor
      const clientTime = new Date().toISOString()
      
      const res = await fetch('/api/payment', {
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

  const handleStopClick = () => {
    setShowAmountModal(true)
  }

  const handleConfirmAmount = useCallback(async () => {
    const numAmount = Number.parseFloat(amount)
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      setError('Ingresa un monto válido')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Enviar la hora del cliente (laptop) al servidor
      const clientTime = new Date().toISOString()
      
      const res = await fetch('/api/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount, clientTime, jobNumber })
      })
      const data = await res.json()

      if (data.success) {
        setIsRunning(false)
        setStartTime(null)
        setElapsedSeconds(0) // Reset counter to zero
        setJobNumber('')
        stopBackgroundTimer()
        await releaseWakeLock()
        
        setResult({
          amount: numAmount,
          hourlyRate: data.data.calculatedHourlyRate
        })
        
        setShowAmountModal(false)
        setAmount('')
        
        if (onComplete) {
          onComplete()
        }
      } else {
        setError(data.error || 'Error al completar')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [amount, onComplete, stopBackgroundTimer, releaseWakeLock])

  const handleCancelModal = () => {
    setShowAmountModal(false)
    setAmount('')
    setError(null)
  }

  const handleSaveJobNumber = useCallback(async () => {
    try {
      const res = await fetch('/api/payment', {
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

  return (
    <>
      <Card className="w-full max-w-md mx-auto border-0 shadow-xl shadow-blue-100">
        <CardHeader className="text-center pb-2 sm:pb-4">
          <CardTitle className="flex items-center justify-center gap-2 text-xl sm:text-2xl">
            <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            Trabajo por Pago
          </CardTitle>
          {isRunning && wakeLockActive && (
            <div className="flex items-center justify-center gap-1 text-xs text-blue-600">
              <Clock className="h-3 w-3" />
              <span>Modo background activo</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
          {/* Timer Display */}
          <div className="text-center">
            <div className={`text-4xl sm:text-6xl font-mono font-bold transition-colors ${
              isRunning ? 'text-blue-600' : 'text-gray-600'
            }`}>
              {formatDuration(elapsedSeconds)}
            </div>
            {isRunning && startTime && (
              <div className="text-sm text-gray-400 mt-2">
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
                      className="w-24 px-2 py-1 text-sm rounded border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none font-mono"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveJobNumber}
                      className="h-7 px-2 text-xs bg-blue-500 hover:bg-blue-600"
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
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
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

          {/* Result Display */}
          {result && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-3">
                <Check className="h-5 w-5" />
                <span className="font-medium">¡Trabajo Completado!</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-500">Monto</div>
                  <div className="text-xl font-bold text-gray-900">{formatCurrency(result.amount)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Por Hora</div>
                  <div className="text-xl font-bold text-blue-600">{formatCurrency(result.hourlyRate)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !showAmountModal && (
            <div className="text-center text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-center gap-4">
            {isRunning ? (
              <Button
                onClick={handleStopClick}
                disabled={isLoading}
                className="min-w-[160px] sm:min-w-[200px] py-4 sm:py-6 text-base sm:text-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl shadow-lg shadow-blue-200"
              >
                <Square className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                FINALIZAR
              </Button>
            ) : (
              <Button
                onClick={handleStart}
                disabled={isLoading}
                className="min-w-[160px] sm:min-w-[200px] py-4 sm:py-6 text-base sm:text-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl shadow-lg shadow-blue-200"
              >
                <Play className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                {isLoading ? 'Iniciando...' : 'INICIAR'}
              </Button>
            )}
          </div>

          {/* Info */}
          <div className="text-center text-xs sm:text-sm text-gray-400 pt-2">
            Al finalizar, ingresa el monto para calcular tu tarifa por hora
          </div>
        </CardContent>
      </Card>

      {/* Amount Modal */}
      {showAmountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
              Ingresa el Monto
            </h3>
            <p className="text-gray-500 text-sm text-center mb-4">
              ¿Cuánto te pagarán por este trabajo?
            </p>
            
            <div className="mb-4">
              <div className="text-center text-sm text-gray-500 mb-2">
                Tiempo trabajado: <span className="font-mono font-medium">{formatDuration(elapsedSeconds)}</span>
              </div>
            </div>

            <div className="relative mb-4">
              <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-4 text-2xl text-center rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none font-mono"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleCancelModal}
                variant="ghost"
                className="flex-1 py-4"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmAmount}
                disabled={isLoading}
                className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
              >
                {isLoading ? 'Guardando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
