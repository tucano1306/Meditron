'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Timer } from '@/components/Timer'
import { SummaryCards } from '@/components/SummaryCards'
import { EntryList } from '@/components/EntryList'
import { WeekHistory } from '@/components/WeekHistory'
import { WeeklySummaryCard } from '@/components/WeeklySummaryCard'
import { RateCalculator } from '@/components/RateCalculator'
import { CompanySearch } from '@/components/CompanySearch'
import { InstallPWA } from '@/components/InstallPWA'
import { AddHoursForm, PayWeeksList, PayWeeksSummary } from '@/components/PayWeeks'
import { CompanyManager } from '@/components/CompanyManager'
import { ExportCard } from '@/components/ExportCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, BarChart3, Calculator, Clock, LogOut, Plus, Search, Settings2 } from 'lucide-react'
import { describeRule, ruleFor, weekLabel, weekShortLabel, type Company, type OvertimeRules } from '@/lib/companies'
import { saveCompanyRate } from '@/lib/company-client'
import { getFloridaDateString } from '@/lib/utils'
import { refreshCompanies, useCompanies } from '@/hooks/useCompanies'

const COMPANY_STORAGE_KEY = 'meditron_company_id'

const tabTriggerClass = 'flex-1 flex flex-col items-center gap-1 py-3 px-1 text-[11px] font-medium text-[#787774] rounded-lg border-0 data-[state=active]:bg-[#37352f] data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-[rgba(55,53,47,0.06)] transition-all touch-manipulation min-h-[52px]'

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
      companyId: string | null
      calculatedAmount: number | null
    }>
    totalSeconds: number
    totalHours: number
    earnings: number
  }
  /** Semana de pago actual de la compañía (su día de inicio, con overtime) */
  currentWeek: {
    start: string
    end: string
    weekNumber: number | null
    totalSeconds: number
    overtimeSeconds: number
    earnings: number
  }
  /** Mes calendario */
  monthSummary: {
    year: number
    month: number
    totalSeconds: number
    earnings: number
  }
  hourlyRate: number
  companyId: string
  runningCompanyId: string | null
  overtime: {
    kind: 'week' | 'day' | 'entry'
    periodStart: string
    periodEnd: string
    completedSeconds: number
    rules: OvertimeRules | null
  }
}

/**
 * Semanas, Resumen y Calc por trabajos: para compañías por hora que registran
 * trabajos con semana de lunes a domingo (esas vistas agrupan así). Las demás
 * las ven por semana de pago (cualquier día de inicio, con overtime) y agregan
 * horas con entrada y salida. Hoy y Buscar son iguales para todas.
 */
function usesJobsView(company: Company, today: string): boolean {
  return ruleFor(company, today).payType === 'hourly'
    && (company.trackJobNumber || company.trackCompanyPaid)
    && company.weekStartsOn === 1
}

interface CompanySwitcherProps {
  readonly companies: Company[]
  readonly value: string
  readonly onChange: (companyId: string) => void
  readonly runningCompanyId: string | null
  readonly onManage: () => void
}

// Elige qué compañía se ve (y con cuál se inicia el próximo trabajo)
function CompanySwitcher({ companies, value, onChange, runningCompanyId, onManage }: CompanySwitcherProps) {
  const today = getFloridaDateString()
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-wide text-[#787774]">Compañía</span>
        <button
          type="button"
          onClick={onManage}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-[4px] text-[12px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] transition-colors touch-manipulation"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Configurar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Compañía">
        {companies.map(company => {
          const active = value === company.id
          return (
            <button
              key={company.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(company.id)}
              className={`relative overflow-hidden rounded-xl pl-4 pr-3 py-3 text-left transition-colors touch-manipulation ${active ? 'bg-[#37352f] text-white shadow-sm' : 'bg-white text-[#37352f] border border-[rgba(55,53,47,0.16)] hover:bg-[rgba(55,53,47,0.04)]'}`}
            >
              <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: company.color }} />
              <div className="text-[14px] font-semibold leading-tight truncate">{company.name}</div>
              <div className={`text-[11px] mt-0.5 ${active ? 'text-white/70' : 'text-[#787774]'}`}>
                {weekShortLabel(company.weekStartsOn)} · {describeRule(ruleFor(company, today))}
              </div>
              {runningCompanyId === company.id && (
                <div className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold ${active ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Turno en curso
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function HourlyDashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  // Al abrir la app con un turno en curso se muestra la compañía de ese turno
  const followedRunningEntry = useRef(false)

  const companies = useCompanies()
  const activeCompanies = companies?.filter(c => !c.archived) ?? []
  const company = activeCompanies.find(c => c.id === selectedId) ?? activeCompanies[0] ?? null
  const companyId = company?.id ?? null

  // Al entrar: compañías frescas (pudo cambiar el usuario) y la compañía elegida
  // en la pantalla de inicio (?company=) o, si no, la última usada
  useEffect(() => {
    refreshCompanies().catch(err => console.error('Error loading companies:', err))
    const chosen = new URLSearchParams(globalThis.location.search).get('company')
    // Elegida a propósito: se muestra aunque haya un turno en curso en otra compañía
    if (chosen) followedRunningEntry.current = true
    try {
      const saved = chosen ?? localStorage.getItem(COMPANY_STORAGE_KEY)
      if (saved) setSelectedId(saved)
    } catch { /* sin almacenamiento disponible */ }
  }, [])

  const handleCompanyChange = (next: string) => {
    setSelectedId(next)
    try {
      localStorage.setItem(COMPANY_STORAGE_KEY, next)
    } catch { /* sin almacenamiento disponible */ }
  }

  const fetchDashboard = useCallback(async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/dashboard?companyId=${encodeURIComponent(companyId)}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
        setError(null)
        if (!followedRunningEntry.current) {
          followedRunningEntry.current = true
          const running: string | null = result.data.runningCompanyId
          if (running && running !== companyId) setSelectedId(running)
        }
      } else {
        setError(result.error || 'Error al cargar datos')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('Error fetching dashboard:', err)
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchDashboard()
    }
  }, [status, router, fetchDashboard])

  const handleTimerStop = () => {
    fetchDashboard()
    setRefreshKey(prev => prev + 1) // Las listas de semanas incluyen el trabajo recién cerrado
  }

  const handleEntryDelete = () => {
    fetchDashboard()
    setRefreshKey(prev => prev + 1) // Forzar refresh de componentes de semanas/meses
  }

  const handleEntryUpdate = () => {
    fetchDashboard()
    setRefreshKey(prev => prev + 1) // Forzar refresh del resumen semanal
  }

  // Cambiar la tarifa crea una versión nueva del esquema de pago desde esta semana
  const handleSaveRate = async (rate: number): Promise<string | null> => {
    if (!company) return 'No hay compañía seleccionada'
    const saveError = await saveCompanyRate(company, rate)
    if (!saveError) {
      await refreshCompanies()
      handleEntryUpdate()
    }
    return saveError
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  if (status === 'loading' || isLoading || !company) {
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

  const today = getFloridaDateString()
  const jobsView = usesJobsView(company, today)
  const tabs = [
    { value: 'today', label: 'Hoy', icon: <Clock className="h-4 w-4" /> },
    { value: 'weeks', label: 'Semanas', icon: <Calendar className="h-4 w-4" /> },
    { value: 'months', label: 'Resumen', icon: <BarChart3 className="h-4 w-4" /> },
    jobsView
      ? { value: 'add', label: 'Calc', icon: <Calculator className="h-4 w-4" /> }
      : { value: 'add', label: 'Agregar', icon: <Plus className="h-4 w-4" /> },
    { value: 'search', label: 'Buscar', icon: <Search className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-[100dvh] bg-[#ffffff] font-notion">
      {/* Topbar */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[rgba(55,53,47,0.09)] bg-[#ffffff]">
        {/* El logo y el título llevan a la pantalla de inicio */}
        <button
          type="button"
          onClick={() => router.push('/mode-select')}
          className="-ml-1.5 flex items-center gap-2 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-[rgba(55,53,47,0.08)] touch-manipulation"
          aria-label="Volver al inicio"
          title="Volver al inicio"
        >
          <div className="w-6 h-6 bg-[#37352f] rounded flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[14px] font-semibold text-[#37352f]">Por Hora</span>
        </button>
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
        {/* Compañía */}
        <section className="mb-4">
          <CompanySwitcher
            companies={activeCompanies}
            value={company.id}
            onChange={handleCompanyChange}
            runningCompanyId={data.runningCompanyId}
            onManage={() => setManagerOpen(true)}
          />
        </section>

        {/* Timer */}
        <section className="mb-6">
          <Timer
            onTimerStop={handleTimerStop}
            initialState={data.timerState}
            hourlyRate={data.hourlyRate}
            companies={companies ?? []}
            company={company.id}
            overtime={data.companyId === company.id ? data.overtime : undefined}
            onCompanyChange={handleEntryUpdate}
            onSwitchView={handleCompanyChange}
            onSaveRate={handleSaveRate}
          />
        </section>

        {/* Resumen: hoy, semana de pago, mes y tarifa */}
        <section className="mb-6">
          <SummaryCards
            company={company}
            today={data.today}
            currentWeek={data.currentWeek}
            monthSummary={data.monthSummary}
            runningHere={data.timerState.isRunning && data.runningCompanyId === company.id}
            onSaveRate={handleSaveRate}
          />
        </section>

        {/* Pestañas: el contenido se adapta a cómo trabaja la compañía */}
        <Tabs defaultValue="today" className="w-full" onValueChange={(tab) => { if (tab === 'months') setRefreshKey(prev => prev + 1) }}>
          <TabsList className="flex w-full mb-5 h-auto bg-white rounded-xl border border-[rgba(55,53,47,0.09)] shadow-sm p-1 gap-0.5">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className={tabTriggerClass}>
                {tab.icon}
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="today">
            <EntryList
              key={company.id}
              entries={data.today.entries}
              title={company.trackJobNumber ? 'Trabajos de hoy' : 'Turnos de hoy'}
              onDelete={handleEntryDelete}
              onUpdate={handleEntryUpdate}
              hourlyRate={data.hourlyRate}
              showCompanyPaid={company.trackCompanyPaid}
            />
          </TabsContent>

          <TabsContent value="weeks">
            {jobsView ? (
              <WeekHistory refreshTrigger={refreshKey} onRefresh={handleEntryUpdate} companyId={company.id} />
            ) : (
              <PayWeeksList key={company.id} company={company} refreshTrigger={refreshKey} onRefresh={handleEntryUpdate} />
            )}
          </TabsContent>

          <TabsContent value="months">
            {jobsView ? (
              <div className="space-y-4">
                <WeeklySummaryCard refreshTrigger={refreshKey} onRefresh={handleEntryUpdate} hourlyRate={data.hourlyRate} companyId={company.id} />
                <ExportCard company={company} />
              </div>
            ) : (
              <PayWeeksSummary key={company.id} company={company} refreshTrigger={refreshKey} onRefresh={handleEntryUpdate} />
            )}
          </TabsContent>

          <TabsContent value="add">
            {jobsView ? (
              <RateCalculator onSave={handleEntryUpdate} hourlyRate={data.hourlyRate} companyId={company.id} />
            ) : (
              <div className="space-y-2">
                <p className="px-1 text-[13px] text-[#787774]">
                  ¿Olvidaste iniciar el cronómetro? Registra la entrada y la salida del turno.
                </p>
                <AddHoursForm key={company.id} company={company} onSaved={handleEntryUpdate} startOpen />
              </div>
            )}
          </TabsContent>

          <TabsContent value="search">
            <CompanySearch key={company.id} company={company} refreshTrigger={refreshKey} onRefresh={handleEntryUpdate} />
          </TabsContent>
        </Tabs>

        <footer className="text-center mt-8 text-[12px] text-[#787774] pb-8">
          Las semanas de pago de {company.name} van de {weekLabel(company.weekStartsOn)}
        </footer>
      </div>

      {managerOpen && companies && (
        <CompanyManager
          companies={companies}
          onClose={() => setManagerOpen(false)}
          onChanged={handleEntryUpdate}
        />
      )}

      <InstallPWA />
    </div>
  )
}
