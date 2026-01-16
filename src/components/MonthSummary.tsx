'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { BarChart3, Calendar } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface MonthData {
  id: string
  year: number
  month: number
  totalHours: number
  earnings: number
}

interface MonthSummaryProps {
  readonly refreshTrigger?: number
}

export function MonthSummary({ refreshTrigger = 0 }: Readonly<MonthSummaryProps>) {
  const [months, setMonths] = useState<MonthData[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Resumen Mensual
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {months.map((month) => (
            <div key={month.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">
                    {getMonthName(month.month)} {month.year}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold">{month.totalHours.toFixed(2)}h</span>
                  <span className="text-green-600 ml-2 font-semibold">
                    {formatCurrency(month.earnings)}
                  </span>
                </div>
              </div>
              <Progress value={(month.totalHours / maxHours) * 100} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
