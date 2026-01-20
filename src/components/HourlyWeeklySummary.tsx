'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Calendar, TrendingUp, TrendingDown, DollarSign, Clock, Briefcase, AlertCircle, Edit, Save, X } from 'lucide-react'

interface HourlyWeeklySummaryData {
  weekNumber: number
  year: number
  startDate: string
  endDate: string
  totalJobs: number
  totalHours: number
  calculatedAmount: number
  companyPaidAmount: number
  difference: number
  differencePercentage: number
}

export function HourlyWeeklySummary() {
  const [weeklyData, setWeeklyData] = useState<HourlyWeeklySummaryData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingWeek, setEditingWeek] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')

  const fetchData = async () => {
    try {
      const res = await fetch('/api/entries/weekly-summary')
      const data = await res.json()
      
      if (data.success) {
        setWeeklyData(data.data)
      }
    } catch (error) {
      console.error('Error fetching weekly summary:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const startEditingWeek = (week: HourlyWeeklySummaryData) => {
    setEditingWeek(`${week.year}-${week.weekNumber}`)
    setEditAmount(week.companyPaidAmount > 0 ? week.companyPaidAmount.toString() : '')
  }

  const cancelEditing = () => {
    setEditingWeek(null)
    setEditAmount('')
  }

  const saveCompanyPayment = async (week: HourlyWeeklySummaryData) => {
    const amount = Number.parseFloat(editAmount)
    if (Number.isNaN(amount) || amount < 0) {
      alert('Por favor ingrese un monto válido')
      return
    }

    try {
      const res = await fetch('/api/entries/update-company-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekNumber: week.weekNumber,
          year: week.year,
          companyPaid: amount
        })
      })

      const result = await res.json()
      if (result.success) {
        cancelEditing()
        fetchData()
      } else {
        alert('Error al guardar el pago: ' + (result.error || 'Error desconocido'))
      }
    } catch (error) {
      console.error('Error saving company payment:', error)
      alert('Error al guardar el pago')
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Resumen Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    )
  }

  if (weeklyData.length === 0) {
    return (
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Resumen Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
          Resumen Semanal - Comparación de Pagos
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="space-y-4">
          {weeklyData.map((week) => {
            const hasDifference = week.companyPaidAmount > 0
            const differenceClass = week.difference >= 0 ? 'text-green-600' : 'text-red-600'
            const isEditing = editingWeek === `${week.year}-${week.weekNumber}`
            
            return (
              <div key={`${week.year}-${week.weekNumber}`} className="border rounded-lg p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      Semana {week.weekNumber} - {week.year}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {new Date(week.startDate).toLocaleDateString('es-ES', { 
                        month: 'short', 
                        day: 'numeric' 
                      })} - {new Date(week.endDate).toLocaleDateString('es-ES', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  {hasDifference && !isEditing && (
                    <div className={`flex items-center gap-1 ${differenceClass}`}>
                      {week.difference >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      <span className="font-semibold text-sm">
                        {week.differencePercentage.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Trabajos */}
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                    <Briefcase className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Trabajos</p>
                      <p className="font-semibold text-sm">{week.totalJobs}</p>
                    </div>
                  </div>

                  {/* Horas */}
                  <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Horas</p>
                      <p className="font-semibold text-sm">{week.totalHours.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Monto Calculado */}
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Calculado</p>
                      <p className="font-semibold text-sm">{formatCurrency(week.calculatedAmount)}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Comparison */}
                {hasDifference || isEditing ? (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        Pagado por Compañía:
                      </span>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            className="w-28 px-2 py-1 text-sm border rounded text-right"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => saveCompanyPayment(week)}
                            className="text-green-600 hover:text-green-700 h-8 w-8"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={cancelEditing}
                            className="text-gray-400 hover:text-gray-600 h-8 w-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {formatCurrency(week.companyPaidAmount)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEditingWeek(week)}
                            className="text-gray-400 hover:text-blue-600 h-8 w-8"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {!isEditing && hasDifference && (
                      <>
                        <div className={`flex justify-between items-center pt-2 border-t`}>
                          <span className="text-xs sm:text-sm font-medium">
                            Diferencia:
                          </span>
                          <span className={`font-bold text-sm ${differenceClass}`}>
                            {week.difference >= 0 ? '+' : ''}{formatCurrency(week.difference)}
                          </span>
                        </div>
                        {week.difference < 0 && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 pt-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>La compañía pagó menos de lo calculado</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <span className="text-xs text-amber-700">
                          Sin registro de pago de compañía
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditingWeek(week)}
                        className="text-xs h-7"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Registrar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
