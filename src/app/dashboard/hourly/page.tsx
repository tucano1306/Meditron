'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Timer } from '@/components/Timer'
import { SummaryCards } from '@/components/SummaryCards'
import { EntryList } from '@/components/EntryList'
import { WeekHistory } from '@/components/WeekHistory'
import { MonthSummary } from '@/components/MonthSummary'
import { RateCalculator } from '@/components/RateCalculator'
import { InstallPWA } from '@/components/InstallPWA'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Calendar, BarChart3, Calculator, Clock, ArrowLeft, LogOut, User } from 'lucide-react'

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

export default function HourlyDashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
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
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchDashboard()
    }
  }, [status, router, fetchDashboard])

  const handleTimerStop = () => {
    fetchDashboard()
  }

  const handleEntryDelete = () => {
    fetchDashboard()
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center text-red-500">
          <p>{error}</p>
          <button
            onClick={() => {
              setIsLoading(true)
              fetchDashboard()
            }}
            className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/mode-select')}
              className="text-gray-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Por Hora</h1>
                <p className="text-xs text-gray-500">Control de tiempo</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-gray-500 text-sm">
              <User className="w-4 h-4" />
              <span>{session?.user?.name || session?.user?.email?.split('@')[0]}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-500"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Timer */}
        <section className="mb-6">
          <Timer
            onTimerStop={handleTimerStop}
            initialState={data.timerState}
          />
        </section>

        {/* Summary Cards */}
        <section className="mb-6">
          <SummaryCards
            today={data.today}
            currentWeek={data.currentWeek}
            monthSummary={data.monthSummary}
            hourlyRate={data.hourlyRate}
          />
        </section>

        {/* Tabs */}
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4 h-auto bg-white/50 backdrop-blur-sm rounded-xl p-1">
            <TabsTrigger 
              value="today" 
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2.5 px-2 sm:px-3 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Clock className="h-4 w-4" />
              <span>Hoy</span>
            </TabsTrigger>
            <TabsTrigger 
              value="weeks" 
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2.5 px-2 sm:px-3 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Calendar className="h-4 w-4" />
              <span>Semanas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="months" 
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2.5 px-2 sm:px-3 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Meses</span>
            </TabsTrigger>
            <TabsTrigger 
              value="calculator" 
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2.5 px-2 sm:px-3 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Calculator className="h-4 w-4" />
              <span>Calc</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <EntryList
              entries={data.today.entries}
              title="Entradas de Hoy"
              onDelete={handleEntryDelete}
              onUpdate={fetchDashboard}
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
        <footer className="text-center mt-6 text-xs text-gray-400 pb-20">
          <p>Las semanas van de Lunes a Domingo</p>
        </footer>
      </div>
      
      <InstallPWA />
    </div>
  )
}
