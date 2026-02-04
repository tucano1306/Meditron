'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { BarChart3, Calendar, ChevronLeft, ChevronRight, DollarSign, Check, X, Edit2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

const ITEMS_PER_PAGE = 5

interface MonthData {
  id: string
  year: number
  month: number
  totalHours: number
  earnings: number
  companyPaid: number | null
}

interface MonthSummaryProps {
  readonly refreshTrigger?: number
}

export function MonthSummary({ refreshTrigger = 0 }: Readonly<MonthSummaryProps>) {
  const [months, setMonths] = useState<MonthData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function fetchMonths() {
      try {
        const res = await fetch('/api/months')
        const data = await res.json()
        
        if (data.success) {
          setMonths(data.data)
        }
      } catch (error) {
        console.error('Error fetching months:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchMonths()
  }, [refreshTrigger])

  const startEditing = (month: MonthData) => {
    setEditingMonth(month.id)
    setEditValue(month.companyPaid?.toString() || '')
  }

  const cancelEditing = () => {
    setEditingMonth(null)
    setEditValue('')
  }

  const saveCompanyPaid = async (month: MonthData) => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/months/update-company-payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: month.year,
          month: month.month,
          companyPaid: editValue ? Number.parseFloat(editValue) : null
        })
      })

      if (res.ok) {
        // Actualizar el estado local
        setMonths(prev => prev.map(m => 
          m.id === month.id 
            ? { ...m, companyPaid: editValue ? Number.parseFloat(editValue) : null }
            : m
        ))
        setEditingMonth(null)
        setEditValue('')
      }
    } catch (error) {
      console.error('Error saving company payment:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const getDifferenceEmoji = (earnings: number, companyPaid: number | null) => {
    if (companyPaid === null) return null
    const diff = companyPaid - earnings
    if (diff >= 0) {
      return <span className="text-lg" title={`+${formatCurrency(diff)}`}>😊</span>
    } else {
      return <span className="text-lg" title={`${formatCurrency(diff)}`}>😞</span>
    }
  }

  const getDifferenceColor = (earnings: number, companyPaid: number | null) => {
    if (companyPaid === null) return ''
    const diff = companyPaid - earnings
    return diff >= 0 ? 'text-green-600' : 'text-red-600'
  }

  // Paginación
  const totalPages = Math.ceil(months.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedMonths = months.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumen Mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Cargando...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (months.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumen Mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No hay datos mensuales
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calcular el máximo para las barras de progreso
  const maxHours = Math.max(...months.map(m => m.totalHours), 1)

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
          Resumen Mensual
          <span className="text-xs font-normal text-gray-500">({months.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="space-y-4">
          {paginatedMonths.map((month) => {
            const isEditing = editingMonth === month.id
            const difference = month.companyPaid === null ? null : month.companyPaid - month.earnings

            return (
              <div key={month.id} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-sm sm:text-base truncate">
                      {getMonthName(month.month)} {month.year}
                    </span>
                    {getDifferenceEmoji(month.earnings, month.companyPaid)}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-semibold text-sm sm:text-base">{month.totalHours.toFixed(1)}h</span>
                  </div>
                </div>

                {/* Calculado por la app */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Calculado:</span>
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(month.earnings)}
                  </span>
                </div>

                {/* Pagado por la compañía */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Pagado:
                  </span>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 px-2 py-1 text-sm border rounded text-right"
                        placeholder="0.00"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => saveCompanyPaid(month)}
                        disabled={isSaving}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={cancelEditing}
                        disabled={isSaving}
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className={`font-semibold ${month.companyPaid === null ? 'text-gray-400' : 'text-green-600'}`}>
                        {month.companyPaid === null ? 'Sin registrar' : formatCurrency(month.companyPaid)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => startEditing(month)}
                      >
                        <Edit2 className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Diferencia */}
                {month.companyPaid !== null && (
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-200">
                    <span className="text-gray-500">Diferencia:</span>
                    <span className={`font-bold ${getDifferenceColor(month.earnings, month.companyPaid)}`}>
                      {difference !== null && difference >= 0 ? '+' : ''}
                      {difference === null ? '-' : formatCurrency(difference)}
                    </span>
                  </div>
                )}

                <Progress value={(month.totalHours / maxHours) * 100} className="mt-2" />
              </div>
            )
          })}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="text-sm text-gray-500">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
