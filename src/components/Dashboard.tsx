'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Timer } from '@/components/Timer'
import { SummaryCards } from '@/components/SummaryCards'
import { EntryList } from '@/components/EntryList'
import { WeekHistory } from '@/components/WeekHistory'
import { MonthSummary } from '@/components/MonthSummary'
import { RateCalculator } from '@/components/RateCalculator'
import { InstallPWA } from '@/components/InstallPWA'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, BarChart3, Calculator, Clock } from 'lucide-react'

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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Clock className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-gray-600 font-medium">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-sm mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button
            onClick={() => {
              setIsLoading(true)
              fetchDashboard()
            }}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
          >
            🔄 Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-white to-green-50/50">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="relative">
              <Image 
                src="/logo.png" 
                alt="Meditron Logo" 
                width={56} 
                height={56}
                className="rounded-2xl shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                <Clock className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                Meditron
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">
                Control de Horas ⏱️
              </p>
            </div>
          </div>
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
          <TabsList className="grid w-full grid-cols-4 mb-4 h-auto bg-white/80 backdrop-blur-sm rounded-2xl p-1.5 shadow-lg border border-gray-100">
            <TabsTrigger value="today" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2.5 px-1 sm:px-3 text-xs sm:text-sm rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Hoy</span>
            </TabsTrigger>
            <TabsTrigger value="weeks" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2.5 px-1 sm:px-3 text-xs sm:text-sm rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Semanas</span>
            </TabsTrigger>
            <TabsTrigger value="months" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2.5 px-1 sm:px-3 text-xs sm:text-sm rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Meses</span>
            </TabsTrigger>
            <TabsTrigger value="calculator" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2.5 px-1 sm:px-3 text-xs sm:text-sm rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Calc</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <EntryList
              entries={data.today.entries}
              title="Entradas de Hoy"
              onDelete={handleEntryDelete}
              onUpdate={fetchDashboard}
              hourlyRate={data.hourlyRate}
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
        <footer className="text-center mt-6 sm:mt-8 text-xs sm:text-sm text-gray-400 pb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-gray-100">
            <Calendar className="w-4 h-4" />
            <span>Semanas: Lunes → Domingo</span>
          </div>
        </footer>
      </div>
      
      {/* Install PWA Banner */}
      <InstallPWA />
    </div>
  )
}
