'use client'

import { useState, useEffect, useCallback } from 'react'
import { Timer } from '@/components/Timer'
import { SummaryCards } from '@/components/SummaryCards'
import { EntryList } from '@/components/EntryList'
import { WeekHistory } from '@/components/WeekHistory'
import { MonthSummary } from '@/components/MonthSummary'
import { RateCalculator } from '@/components/RateCalculator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, Calendar, BarChart3, Calculator } from 'lucide-react'

interface DashboardData {
  timerState: {
    isRunning: boolean
    startTime: string | null
    currentEntryId: string | null
    elapsedSeconds: number
  }
  today: {
    date: string
    entries: Array<{
      id: string
      startTime: string
      endTime: string | null
      duration: number | null
      date: string
    }>
    totalSeconds: number
    totalHours: number
    earnings: number
  }
  currentWeek: {
    weekNumber: number
    year: number
    month: number
    startDate: string
    endDate: string
    totalHours: number
    earnings: number
    entries: Array<{
      id: string
      startTime: string
      endTime: string | null
      duration: number | null
      date: string
    }>
  }
  monthSummary: {
    year: number
    month: number
    totalHours: number
    earnings: number
  }
  hourlyRate: number
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      const result = await res.json()
      
      if (result.success) {
        setData(result.data)
        setError(null)
      } else {
        setError(result.error || 'Error al cargar datos')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('Error fetching dashboard:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const handleTimerStop = () => {
    // Refrescar datos cuando se detiene el timer
    fetchDashboard()
  }

  const handleEntryDelete = () => {
    fetchDashboard()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-500">
          <p>{error}</p>
          <button
            onClick={() => {
              setIsLoading(true)
              fetchDashboard()
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            Meditron
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1 sm:mt-2">
            Control de Horas
          </p>
        </header>

        {/* Timer */}
        <section className="mb-6 sm:mb-8">
          <Timer
            onTimerStop={handleTimerStop}
            initialState={data.timerState}
          />
        </section>

        {/* Summary Cards */}
        <section className="mb-6 sm:mb-8">
          <SummaryCards
            today={data.today}
            currentWeek={data.currentWeek}
            monthSummary={data.monthSummary}
            hourlyRate={data.hourlyRate}
          />
        </section>

        {/* Tabs */}
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4 h-auto">
            <TabsTrigger value="today" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-1 sm:px-3 text-xs sm:text-sm">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Hoy</span>
            </TabsTrigger>
            <TabsTrigger value="weeks" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-1 sm:px-3 text-xs sm:text-sm">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Semanas</span>
            </TabsTrigger>
            <TabsTrigger value="months" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-1 sm:px-3 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Meses</span>
            </TabsTrigger>
            <TabsTrigger value="calculator" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-1 sm:px-3 text-xs sm:text-sm">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Calc</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <EntryList
              entries={data.today.entries}
              title="Entradas de Hoy"
              onDelete={handleEntryDelete}
            />
          </TabsContent>

          <TabsContent value="weeks">
            <WeekHistory onRefresh={fetchDashboard} />
          </TabsContent>

          <TabsContent value="months">
            <MonthSummary />
          </TabsContent>

          <TabsContent value="calculator">
            <RateCalculator onSave={fetchDashboard} />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="text-center mt-6 sm:mt-8 text-xs sm:text-sm text-gray-400">
          <p>Las semanas van de Lunes a Domingo</p>
        </footer>
      </div>
    </div>
  )
}
