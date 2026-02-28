'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calculator, Clock, DollarSign, TrendingUp, RotateCcw, Save, Check } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PaymentCalculatorProps {
  readonly onSave?: () => void
}

export function PaymentCalculator({ onSave }: Readonly<PaymentCalculatorProps>) {
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [amount, setAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const result = useMemo(() => {
    const h = Number.parseFloat(hours) || 0
    const m = Number.parseFloat(minutes) || 0
    const payment = Number.parseFloat(amount) || 0
    
    const totalHours = h + (m / 60)
    
    if (totalHours > 0 && payment > 0) {
      const hourlyRate = payment / totalHours
      return {
        totalHours,
        hourlyRate,
        payment,
        isValid: true
      }
    }
    
    return {
      totalHours,
      hourlyRate: 0,
      payment,
      isValid: false
    }
  }, [hours, minutes, amount])

  const handleReset = () => {
    setHours('')
    setMinutes('')
    setAmount('')
    setSaved(false)
  }

  const handleSave = async () => {
    if (!result.isValid) return
    
    setIsSaving(true)
    try {
      const now = new Date()
      const totalSeconds = result.totalHours * 3600
      const startTime = new Date(now.getTime() - totalSeconds * 1000)
      
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: startTime.toISOString(),
          endTime: now.toISOString(),
          amount: result.payment
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setSaved(true)
        onSave?.()
        setTimeout(() => {
          handleReset()
        }, 2000)
      }
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <span>Calculadora de Tarifa</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6">
        {/* Time Input */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tiempo Trabajado
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 sm:px-4 py-3 pr-14 sm:pr-16 border rounded-xl text-base sm:text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontSize: '16px' }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  horas
                </span>
              </div>
            </div>
            <span className="text-gray-400 text-xl font-bold">:</span>
            <div className="flex-1">
              <div className="relative">
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="59"
                  className="w-full px-3 sm:px-4 py-3 pr-12 sm:pr-14 border rounded-xl text-base sm:text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontSize: '16px' }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  min
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Input */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pago Recibido
          </label>
          <div className="relative">
            <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">
              $
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full pl-9 sm:pl-10 pr-4 py-3 border rounded-xl text-base sm:text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ fontSize: '16px' }}
            />
          </div>
        </div>

        {/* Result */}
        {result.isValid && (
          <div className="p-4 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="font-medium text-sm sm:text-base">Tu Tarifa por Hora</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-green-600 mb-2">
                {formatCurrency(result.hourlyRate)}
                <span className="text-lg sm:text-xl text-green-500">/h</span>
              </div>
              <div className="text-sm text-gray-500">
                {result.totalHours.toFixed(2)} horas → {formatCurrency(result.payment)}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result.isValid && (
          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-center">
            <div className="text-gray-400 mb-2">
              <TrendingUp className="h-8 w-8 mx-auto opacity-50" />
            </div>
            <p className="text-sm text-gray-500">
              Ingresa el tiempo trabajado y el pago recibido para calcular tu tarifa por hora
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {result.isValid && !saved && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-green-600 hover:bg-green-700 touch-manipulation active:scale-[0.98]"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Guardando...' : 'Guardar Registro'}
            </Button>
          )}
          {saved && (
            <div className="flex-1 flex items-center justify-center gap-2 py-2 text-green-600 bg-green-50 rounded-lg">
              <Check className="h-5 w-5" />
              <span className="font-medium">¡Guardado!</span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleReset}
            className={`touch-manipulation active:scale-[0.98] ${result.isValid && !saved ? '' : 'flex-1'}`}
            disabled={!hours && !minutes && !amount}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-400 text-center">
          Esta calculadora te ayuda a conocer cuánto ganaste por hora en un trabajo específico
        </div>
      </CardContent>
    </Card>
  )
}
