'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calculator, DollarSign, Clock, ArrowRight, Save, Check, CalendarDays } from 'lucide-react'
import { HOURLY_RATE } from '@/lib/utils'

interface RateCalculatorProps {
  readonly onSave?: () => void
  readonly hourlyRate?: number
}

// Función para obtener fecha en formato YYYY-MM-DD
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function RateCalculator({ onSave, hourlyRate = HOURLY_RATE }: RateCalculatorProps) {
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()))
  const [result, setResult] = useState<{
    totalHours: number
    paymentAmount: number
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Calcular automáticamente cuando cambian las horas o minutos
  useEffect(() => {
    const totalHours = Number.parseFloat(hours || '0') + Number.parseFloat(minutes || '0') / 60
    
    if (totalHours > 0) {
      const paymentAmount = totalHours * hourlyRate
      setResult({
        totalHours,
        paymentAmount
      })
      setSaved(false)
    } else {
      setResult(null)
    }
  }, [hours, minutes, hourlyRate])

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
          hourlyRate: hourlyRate,
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
    setSelectedDate(getLocalDateString(new Date()))
    setResult(null)
    setSaved(false)
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-purple-700 text-base sm:text-xl">
          <Calculator className="h-4 w-4 sm:h-5 sm:w-5" />
          Registrar Horas Trabajadas
        </CardTitle>
        <p className="text-sm text-purple-600 mt-1">
          Tarifa actual: <span className="font-bold">${hourlyRate}/hora</span>
        </p>
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
                    style={{ fontSize: '16px' }}
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
                    style={{ fontSize: '16px' }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    min
                  </span>
                </div>
              </div>
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
                style={{ fontSize: '16px' }}
              />
            </div>
          </fieldset>

          {/* Resultado automático */}
          {result && (
            <div className="p-3 sm:p-4 bg-white rounded-lg border border-purple-200 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 flex-shrink-0" />
                  <span className="text-sm sm:text-base text-gray-600 truncate">{result.totalHours.toFixed(2)} hrs</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-br from-green-50 to-emerald-50 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-green-200">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <span className="text-lg sm:text-xl font-bold text-green-700">
                    ${result.paymentAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2">
            {result && !saved && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-green-600 hover:bg-green-700 py-3 sm:py-2 touch-manipulation active:scale-[0.98]"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Guardando...' : 'Guardar Registro'}
              </Button>
            )}
            {saved && (
              <div className="flex-1 flex items-center justify-center gap-2 py-3 text-green-600 bg-green-50 rounded-lg">
                <Check className="h-5 w-5" />
                <span className="font-medium">¡Guardado!</span>
              </div>
            )}
            <Button
              onClick={reset}
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 py-3 sm:py-2"
            >
              Limpiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
