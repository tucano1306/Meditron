'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { PaymentTimer } from '@/components/PaymentTimer'
import { PaymentEntryList } from '@/components/PaymentEntryList'
import { PaymentWeekHistory } from '@/components/PaymentWeekHistory'
import { PaymentMonthSummary } from '@/components/PaymentMonthSummary'
import { PaymentCalculator } from '@/components/PaymentCalculator'

import { InstallPWA } from '@/components/InstallPWA'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { 
  DollarSign, 
  Clock, 
  ArrowLeft, 
  LogOut, 
  User,
  Calendar,
  Briefcase,
  BarChart3,
  Calculator
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PaymentEntry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  amount: number | null
  hourlyRate: number | null
  date: string
  completed: boolean
}

interface DashboardData {
  timerState: {
    isRunning: boolean
    startTime: string | null
    currentEntryId: string | null
    elapsedSeconds: number
  }
  today: {
    date: string
    entries: PaymentEntry[]
    totalSeconds: number
    totalHours: number
    totalAmount: number
    avgHourlyRate: number
    jobCount: number
  }
  month: {
    year: number
    month: number
    totalSeconds: number
    totalHours: number
    totalAmount: number
    avgHourlyRate: number
    jobCount: number
  }
  recentEntries: PaymentEntry[]
}

export default function PaymentDashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/payment/dashboard')
      const result = await res.json()
      
      if (result.success) {
        setData(result.data)
      }
    } catch (err) {
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

  const handleComplete = () => {
    fetchDashboard()
    setRefreshKey(prev => prev + 1)
  }

  const handleRefresh = () => {
    fetchDashboard()
    setRefreshKey(prev => prev + 1)
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
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
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Por Pago</h1>
                <p className="text-xs text-gray-500">Calcula tu tarifa por hora</p>
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
          <PaymentTimer
            onComplete={handleComplete}
            initialState={data?.timerState}
          />
        </section>

        {/* Stats Cards */}
        {data && (
          <section className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
            <Card className="border-0 shadow-lg shadow-blue-50">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-blue-500 mb-1">
                  <Briefcase className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-xs font-medium">Trabajos Hoy</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{data.today.jobCount}</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg shadow-green-50">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-green-500 mb-1">
                  <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-xs font-medium">Ganado Hoy</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">
                  {formatCurrency(data.today.totalAmount)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg shadow-purple-50">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-purple-500 mb-1">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-xs font-medium">Horas Hoy</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">
                  {data.today.totalHours.toFixed(1)}h
                </div>
              </CardContent>
            </Card>
          </section>
        )}

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
            <PaymentEntryList
              entries={data?.today.entries || []}
              title="Trabajos de Hoy"
              onDelete={handleRefresh}
              onUpdate={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="weeks">
            <PaymentWeekHistory key={refreshKey} onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="months">
            <PaymentMonthSummary key={refreshKey} onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="calculator">
            <PaymentCalculator onSave={fetchDashboard} />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="text-center mt-6 text-xs text-gray-400 pb-20">
          <p>Registra trabajos con tiempo y pago para calcular tu tarifa por hora</p>
        </footer>
      </div>
      
      <InstallPWA />
    </div>
  )
}

