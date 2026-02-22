'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Clock, DollarSign, Check, Hash, Pencil, Bus, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, formatTimeInFlorida } from '@/lib/utils'
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
  const [result, setResult] = useState<{ amount: number; hourlyRate: number; jobNumber?: string; vehicle?: string } | null>(null)
  const [jobNumber, setJobNumber] = useState('')
  const [isEditingJobNumber, setIsEditingJobNumber] = useState(false)
  const [jobNumberInput, setJobNumberInput] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [isSelectingVehicle, setIsSelectingVehicle] = useState(false)
  
  const vehicleOptions = [
    { value: 'sprinter', label: 'Sprinter' },
    { value: 'mini-bus', label: 'Mini Bus' },
    { value: 'motorcoach', label: 'Motorcoach' },
  ]
  
  const { startBackgroundTimer, stopBackgroundTimer } = useServiceWorker()
  const { requestWakeLock, releaseWakeLock, isActive: wakeLockActive } = useWakeLock()

  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch('/api/payment')
        const data = await res.json()
        
        if (data.success && data.data) {
          setIsRunning(data.data.isRunning)
          if (data.data.isRunning && data.data.elapsedSeconds !== undefined) {
            // Reconstruir startTime basado en elapsedSeconds del servidor
            // Esto evita problemas de timezone
            const reconstructedStartTime = new Date(Date.now() - (data.data.elapsedSeconds * 1000))
            setStartTime(reconstructedStartTime)
            setElapsedSeconds(data.data.elapsedSeconds)
          } else {
            setElapsedSeconds(0)
          }
          if (data.data.jobNumber) {
            setJobNumber(data.data.jobNumber)
          }
          if (data.data.vehicle) {
            setVehicleType(data.data.vehicle)
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
        // Calcular elapsed usando Date.now() para consistencia
        // startTime ya está en la zona horaria correcta desde el servidor
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
        // Asegurar que nunca sea negativo
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
    setResult(null)

    try {
      await requestWakeLock()
      
      // Enviar la hora UTC del cliente (usando toISOString que siempre es UTC)
      const now = new Date()
      const clientTime = now.toISOString()
      
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime })
      })
      const data = await res.json()

      if (data.success) {
        setIsRunning(true)
        // Usar la hora actual del cliente como startTime para evitar desfases de timezone
        const newStartTime = new Date()
        setStartTime(newStartTime)
        setElapsedSeconds(0)
        setJobNumber('')
        setVehicleType('')
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
      // Enviar la hora UTC del cliente
      const now = new Date()
      const clientTime = now.toISOString()
      
      console.log('handleConfirmAmount - sending:', { amount: numAmount, jobNumber, vehicle: vehicleType })
      
      const res = await fetch('/api/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount, clientTime, jobNumber, vehicle: vehicleType })
      })
      const data = await res.json()
      
      console.log('handleConfirmAmount - response:', data)

      if (data.success) {
        // Guardar jobNumber y vehicle antes de limpiar
        const savedJobNumber = jobNumber
        const savedVehicle = vehicleType
        
        setIsRunning(false)
        setStartTime(null)
        setElapsedSeconds(0) // Reset counter to zero
        setJobNumber('')
        setVehicleType('')
        stopBackgroundTimer()
        await releaseWakeLock()
        
        setResult({
          amount: numAmount,
          hourlyRate: data.data.calculatedHourlyRate,
          jobNumber: savedJobNumber || data.data.entry?.jobNumber,
          vehicle: savedVehicle || data.data.entry?.vehicle
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

  const handleSelectVehicle = async (selectedVehicle: string) => {
    console.log('handleSelectVehicle called with:', selectedVehicle)
    setVehicleType(selectedVehicle)
    setIsSelectingVehicle(false)
    
    // Guardar el vehículo en el servidor
    try {
      const res = await fetch('/api/payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle: selectedVehicle })
      })
      const data = await res.json()
      console.log('PATCH vehicle response:', data)
    } catch (err) {
      console.error('Error saving vehicle:', err)
    }
  }

  const getVehicleLabel = (value: string) => {
    const vehicle = vehicleOptions.find(v => v.value === value)
    return vehicle ? vehicle.label : value
  }

  return (
    <>
      <Card className="w-full max-w-md mx-auto border-0 shadow-2xl bg-gradient-to-br from-white via-white to-blue-50/50 overflow-hidden">
        <CardHeader className="text-center pb-2 sm:pb-4 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5" />
          <CardTitle className="flex items-center justify-center gap-2 text-lg sm:text-xl font-bold relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Trabajo por Pago
            </span>
          </CardTitle>
          {isRunning && wakeLockActive && (
            <div className="flex items-center justify-center gap-1 text-xs text-blue-600 mt-2">
              <Clock className="h-3 w-3 animate-pulse" />
              <span>Modo background activo</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-6">
          {/* Timer Display - NÚMEROS MÁS GRANDES */}
          <div className="text-center py-4 sm:py-6">
            <div className={`text-5xl sm:text-7xl md:text-8xl font-mono font-black tracking-tight transition-all duration-300 ${
              isRunning 
                ? 'text-blue-600 scale-105' 
                : 'text-gray-400'
            }`} style={{ textShadow: isRunning ? '0 4px 20px rgba(37, 99, 235, 0.3)' : 'none' }}>
              {formatDuration(elapsedSeconds)}
            </div>
            {isRunning && startTime && (
              <div className="text-xs sm:text-sm text-gray-400 mt-3 font-medium">
                ⏱️ Iniciado: {formatTimeInFlorida(startTime)}
              </div>
            )}
          </div>

          {/* Job Number - Solo visible cuando está corriendo */}
          {isRunning && (
            <div className="bg-gradient-to-r from-gray-50 to-blue-50/30 rounded-2xl p-3 sm:p-4 border border-blue-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Hash className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold">Trabajo #</span>
                </div>
                {isEditingJobNumber ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={jobNumberInput}
                      onChange={(e) => setJobNumberInput(e.target.value)}
                      placeholder="Ej: 12345"
                      className="flex-1 sm:w-28 sm:flex-none px-3 py-2 text-lg font-mono font-bold rounded-xl border-2 border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-center"
                      style={{ fontSize: '16px' }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveJobNumber}
                      className="h-9 px-3 bg-blue-500 hover:bg-blue-600 rounded-xl flex-shrink-0"
                    >
                      OK
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEditJobNumber}
                      className="h-9 px-2 flex-shrink-0"
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={handleEditJobNumber}
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 transition-all w-full sm:w-auto justify-center sm:justify-start"
                  >
                    {jobNumber ? (
                      <span className="font-mono text-xl font-black text-blue-700">{jobNumber}</span>
                    ) : (
                      <span className="text-gray-400 text-sm">Toca para asignar</span>
                    )}
                    <Pencil className="h-4 w-4 text-blue-500" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Vehicle Type Dropdown - Solo visible cuando está corriendo */}
          {isRunning && (
            <div className="bg-gradient-to-r from-gray-50 to-indigo-50/30 rounded-2xl p-3 sm:p-4 border border-indigo-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Bus className="h-4 w-4 text-indigo-600" />
                  </div>
                  <span className="text-sm font-semibold">Vehículo</span>
                </div>
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => setIsSelectingVehicle(!isSelectingVehicle)}
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-all w-full sm:w-auto sm:min-w-[140px] justify-between"
                  >
                    {vehicleType ? (
                      <span className="font-semibold text-indigo-700">{getVehicleLabel(vehicleType)}</span>
                    ) : (
                      <span className="text-gray-400 text-sm">Seleccionar</span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-indigo-500 transition-transform flex-shrink-0 ${isSelectingVehicle ? 'rotate-180' : ''}`} />
                  </button>
                  {isSelectingVehicle && (
                    <div className="absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden z-10 sm:min-w-[160px]">
                      {vehicleOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleSelectVehicle(option.value)}
                          className={`w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors ${
                            vehicleType === option.value ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
              {/* Job Number and Vehicle */}
              {(result.jobNumber || result.vehicle) && (
                <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
                  {result.jobNumber && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm font-bold rounded-full">
                      #{result.jobNumber}
                    </span>
                  )}
                  {result.vehicle && (
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full flex items-center gap-1">
                      <Bus className="h-3 w-3" />
                      {vehicleOptions.find(v => v.value === result.vehicle)?.label || result.vehicle}
                    </span>
                  )}
                </div>
              )}
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
          <div className="flex justify-center">
            {isRunning ? (
              <Button
                onClick={handleStopClick}
                disabled={isLoading}
                className="w-full max-w-[280px] py-6 sm:py-8 text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl shadow-xl shadow-blue-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Square className="mr-3 h-6 w-6 sm:h-7 sm:w-7" />
                FINALIZAR
              </Button>
            ) : (
              <Button
                onClick={handleStart}
                disabled={isLoading}
                className="w-full max-w-[280px] py-6 sm:py-8 text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl shadow-xl shadow-blue-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="mr-3 h-6 w-6 sm:h-7 sm:w-7" />
                {isLoading ? 'Iniciando...' : 'INICIAR'}
              </Button>
            )}
          </div>

          {/* Info */}
          <div className="text-center text-xs sm:text-sm text-gray-400 pt-2">
            💡 Al finalizar, ingresa el monto para calcular tu tarifa
          </div>
        </CardContent>
      </Card>

      {/* Amount Modal */}
      {showAmountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Drag handle - solo móvil */}
            <div className="sm:hidden flex justify-center -mt-2 mb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
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
                style={{ fontSize: '24px' }}
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
            {/* Safe area padding for iOS */}
            <div className="sm:hidden pb-safe" />
          </div>
        </div>
      )}
    </>
  )
}
