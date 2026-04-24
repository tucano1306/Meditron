'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Timer } from '@/components/Timer'
import { SummaryCards } from '@/components/SummaryCards'
import { EntryList } from '@/components/EntryList'
import { WeekHistory } from '@/components/WeekHistory'
import { WeeklySummaryCard } from '@/components/WeeklySummaryCard'
import { RateCalculator } from '@/components/RateCalculator'

import { InstallPWA } from '@/components/InstallPWA'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, BarChart3, Calculator, Clock, ArrowLeft, LogOut } from 'lucide-react'

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
  const [refreshKey, setRefreshKey] = useState(0)

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
    setRefreshKey(prev => prev + 1) // Forzar refresh de componentes de semanas/meses
  }

  const handleEntryUpdate = () => {
    fetchDashboard()
    setRefreshKey(prev => prev + 1) // Forzar refresh del resumen semanal
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-[#ffffff] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#37352f] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#ffffff] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#787774] text-[14px]">{error}</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true)
              fetchDashboard()
            }}
            className="mt-4 px-4 py-2 text-[13px] bg-[#37352f] text-white rounded-[6px] hover:bg-[#2f2d28] transition-colors"
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
    <div className="min-h-[100dvh] bg-[#ffffff] font-notion">
      {/* Topbar */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[rgba(55,53,47,0.09)] bg-[#ffffff]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/mode-select')}
            className="p-1.5 text-[#787774] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] rounded-[4px] transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#37352f] rounded flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[14px] font-semibold text-[#37352f]">Por Hora</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session?.user?.name && (
            <span className="text-[13px] text-[#787774] hidden sm:inline">
              {session.user.name}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-[#787774] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] rounded-[4px] transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Timer */}
        <section className="mb-6">
          <Timer
            onTimerStop={handleTimerStop}
            initialState={data.timerState}
            hourlyRate={data.hourlyRate}
            onRateChange={(newRate) => {
              setData(prev => prev ? { ...prev, hourlyRate: newRate } : prev)
              fetchDashboard()
            }}
          />
        </section>

        {/* Summary Cards */}
        <section className="mb-6">
          <SummaryCards
            today={data.today}
            currentWeek={data.currentWeek}
            monthSummary={data.monthSummary}
            hourlyRate={data.hourlyRate}
            onRateChange={(newRate) => {
              setData(prev => prev ? { ...prev, hourlyRate: newRate } : prev)
              fetchDashboard()
            }}
          />
        </section>

        {/* Tabs */}
        <Tabs defaultValue="today" className="w-full" onValueChange={(tab) => { if (tab === 'months') setRefreshKey(prev => prev + 1) }}>
          <TabsList className="flex w-full mb-4 h-auto bg-transparent border-b border-[rgba(55,53,47,0.09)] rounded-none p-0 gap-0">
            <TabsTrigger
              value="today"
              className="flex items-center gap-1.5 py-2.5 px-3 text-[13px] text-[#787774] rounded-none border-b-2 border-transparent data-[state=active]:border-[#37352f] data-[state=active]:text-[#37352f] data-[state=active]:bg-transparent hover:bg-[rgba(55,53,47,0.04)] transition-colors"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Hoy</span>
            </TabsTrigger>
            <TabsTrigger
              value="weeks"
              className="flex items-center gap-1.5 py-2.5 px-3 text-[13px] text-[#787774] rounded-none border-b-2 border-transparent data-[state=active]:border-[#37352f] data-[state=active]:text-[#37352f] data-[state=active]:bg-transparent hover:bg-[rgba(55,53,47,0.04)] transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Semanas</span>
            </TabsTrigger>
            <TabsTrigger
              value="months"
              className="flex items-center gap-1.5 py-2.5 px-3 text-[13px] text-[#787774] rounded-none border-b-2 border-transparent data-[state=active]:border-[#37352f] data-[state=active]:text-[#37352f] data-[state=active]:bg-transparent hover:bg-[rgba(55,53,47,0.04)] transition-colors"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Resumen</span>
            </TabsTrigger>
            <TabsTrigger
              value="calculator"
              className="flex items-center gap-1.5 py-2.5 px-3 text-[13px] text-[#787774] rounded-none border-b-2 border-transparent data-[state=active]:border-[#37352f] data-[state=active]:text-[#37352f] data-[state=active]:bg-transparent hover:bg-[rgba(55,53,47,0.04)] transition-colors"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Calc</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <EntryList
              entries={data.today.entries}
              title="Entradas de Hoy"
              onDelete={handleEntryDelete}
              onUpdate={handleEntryUpdate}
              hourlyRate={data.hourlyRate}
            />
          </TabsContent>

          <TabsContent value="weeks">
            <WeekHistory refreshTrigger={refreshKey} onRefresh={handleEntryUpdate} />
          </TabsContent>

          <TabsContent value="months">
            <WeeklySummaryCard refreshTrigger={refreshKey} onRefresh={handleEntryUpdate} hourlyRate={data.hourlyRate} />
          </TabsContent>

          <TabsContent value="calculator">
            <RateCalculator onSave={fetchDashboard} hourlyRate={data.hourlyRate} />
          </TabsContent>
        </Tabs>

        <footer className="text-center mt-8 text-[12px] text-[#787774] pb-8">
          Las semanas van de Lunes a Domingo
        </footer>
      </div>

      <InstallPWA />
    </div>
  )
}
