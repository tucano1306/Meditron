'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calculator, DollarSign, Clock, ArrowDown, Save, Check, CalendarDays } from 'lucide-react'

interface RateCalculatorProps {
  readonly onSave?: () => void
}

// Función para obtener fecha en formato YYYY-MM-DD
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function RateCalculator({ onSave }: RateCalculatorProps) {
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [payment, setPayment] = useState('')
  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()))
  const [result, setResult] = useState<{
    hourlyRate: number
    totalHours: number
    paymentAmount: number
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const calculateRate = () => {
    const totalHours = Number.parseFloat(hours || '0') + Number.parseFloat(minutes || '0') / 60
    const paymentAmount = Number.parseFloat(payment || '0')

    if (totalHours > 0 && paymentAmount > 0) {
      const hourlyRate = paymentAmount / totalHours
      setResult({
        hourlyRate,
        totalHours,
        paymentAmount
      })
      setSaved(false)
    }
  }

  const handleSave = async () => {
    if (!result) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours: Number.parseFloat(hours || '0'),
          minutes: Number.parseFloat(minutes || '0'),
          payment: result.paymentAmount,
          hourlyRate: result.hourlyRate,
          date: selectedDate
        })
      })

      const data = await res.json()
      if (data.success) {
        setSaved(true)
        if (onSave) {
          onSave()
        }
      }
    } catch (error) {
      console.error('Error saving entry:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const reset = () => {
    setHours('')
    setMinutes('')
    setPayment('')
    setSelectedDate(getLocalDateString(new Date()))
    setResult(null)
    setSaved(false)
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-purple-700 text-lg sm:text-xl">
          <Calculator className="h-5 w-5" />
          Calculadora de Tarifa por Hora
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Input de tiempo */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">
              Tiempo trabajado
            </legend>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <input
                    id="hours-input"
                    type="number"
                    min="0"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    hrs
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <div className="relative">
                  <input
                    id="minutes-input"
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    min
                  </span>
                </div>
              </div>
            </div>
          </fieldset>

          {/* Input de pago */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">
              Pago recibido (USD)
            </legend>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                id="payment-input"
                type="number"
                min="0"
                step="0.01"
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
              />
            </div>
          </fieldset>

          {/* Selector de fecha */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">
              Fecha del trabajo
            </legend>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                id="date-input"
                type="date"
                value={selectedDate}
                max={getLocalDateString(new Date())}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Puedes seleccionar días pasados</p>
          </fieldset>

          {/* Botones */}
          <div className="flex gap-2">
            <Button
              onClick={calculateRate}
              className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 sm:py-2"
              disabled={(!hours && !minutes) || !payment}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Calcular
            </Button>
            <Button
              onClick={reset}
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 py-3 sm:py-2"
            >
              Limpiar
            </Button>
          </div>

          {/* Resultado */}
          {result && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-purple-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-center">
                <div className="flex flex-row sm:flex-col items-center gap-2 sm:gap-0">
                  <Clock className="h-5 w-5 text-purple-500 sm:mb-1" />
                  <span className="text-sm text-gray-500">Tiempo:</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {result.totalHours.toFixed(2)} hrs
                  </span>
                </div>
                
                <ArrowDown className="h-5 w-5 text-gray-400 hidden sm:block rotate-0 sm:-rotate-90" />
                
                <div className="flex flex-row sm:flex-col items-center gap-2 sm:gap-0">
                  <DollarSign className="h-5 w-5 text-green-500 sm:mb-1" />
                  <span className="text-sm text-gray-500">Pago:</span>
                  <span className="text-lg font-semibold text-gray-900">
                    ${result.paymentAmount.toFixed(2)}
                  </span>
                </div>
                
                <ArrowDown className="h-5 w-5 text-gray-400 rotate-0 sm:-rotate-90" />
                
                <div className="flex flex-col items-center bg-gradient-to-br from-green-50 to-emerald-50 px-4 py-3 rounded-lg border border-green-200 w-full sm:w-auto">
                  <span className="text-sm text-green-600 font-medium">Tarifa/Hora</span>
                  <span className="text-2xl sm:text-3xl font-bold text-green-700">
                    ${result.hourlyRate.toFixed(2)}
                  </span>
                  <span className="text-xs text-green-500">USD/hr</span>
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="pt-2 border-t border-gray-100">
                {saved ? (
                  <div className="flex flex-col items-center justify-center gap-1 text-green-600 py-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">¡Guardado exitosamente!</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      Registrado para: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full bg-green-600 hover:bg-green-700 py-3"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Guardando...' : 'Guardar en Registros'}
                    </Button>
                    <p className="text-xs text-center text-gray-500">
                      Se guardará para: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
