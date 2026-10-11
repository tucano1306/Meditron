'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { ArrowRight, Clock, DollarSign, Loader2, LogOut, Pause, Plus, Settings2 } from 'lucide-react'
import { CompanyManager } from '@/components/CompanyManager'
import { refreshCompanies, useCompanies } from '@/hooks/useCompanies'
import { dateKeyToUTC, overtimeRulesOf, ruleFor, weekShortLabel, type Company, type PayRule } from '@/lib/companies'
import { formatCurrency, formatDuration, getFloridaDateComponents, getFloridaDateString } from '@/lib/utils'
import { formatTime12 } from '@/lib/report-format'
import { formatHM, formatRange, textOn } from '@/lib/display'

const MODE_STORAGE_KEY = 'meditron_mode'
const COMPANY_STORAGE_KEY = 'meditron_company_id'
const FLORIDA_TIMEZONE = 'America/New_York'
const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface CompanyWeek {
  companyId: string
  start: string
  end: string
  totalSeconds: number
  overtimeSeconds: number
  totalPay: number
  jobCount: number
  todaySeconds: number
  days: { date: string; seconds: number }[]
  lastWorkedDate: string | null
}

interface RunningShift {
  companyId: string | null
  isPaused: boolean
  elapsedSeconds: number
  startTime: string
  jobNumber: string | null
}

interface Overview {
  today: string
  companies: CompanyWeek[]
  running: RunningShift | null
  /** Momento (ms) en que llegó la respuesta, para que el cronómetro siga corriendo */
  receivedAt: number
}

// ── Formato ───────────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  return Math.round((dateKeyToUTC(to).getTime() - dateKeyToUTC(from).getTime()) / 86_400_000)
}

function lastWorkedLabel(lastDate: string | null, today: string): string {
  if (!lastDate) return 'Aún sin turnos'
  const days = daysBetween(lastDate, today)
  if (days <= 0) return 'Último turno: hoy'
  if (days === 1) return 'Último turno: ayer'
  return `Último turno: hace ${days} días`
}

/** "$28/h + overtime": el detalle del overtime se ve en la barra de progreso */
function shortRule(rule: PayRule): string {
  const rate = `$${Number.isInteger(rule.hourlyRate) ? rule.hourlyRate : rule.hourlyRate.toFixed(2)}/h`
  return rule.payType === 'hourly' ? rate : `${rate} + overtime`
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Hora actual que se actualiza sola (cada `intervalMs`) */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// ── Piezas ────────────────────────────────────────────────────────────────────

function TodayHeader({ userName }: { readonly userName: string }) {
  const now = useNow(30_000)
  const { hour } = getFloridaDateComponents(new Date(now))
  const longDate = new Intl.DateTimeFormat('es', { timeZone: FLORIDA_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' })
    .format(now)
  const date = longDate.charAt(0).toUpperCase() + longDate.slice(1)
  const time = formatTime12(new Date(now))

  return (
    <div className="animate-card-in">
      <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(55,53,47,0.09)] bg-white/70 px-3 py-1 text-[12px] font-medium text-[#787774] shadow-[0_1px_2px_rgba(15,15,15,0.04)]">
        <span>{date}</span>
        <span className="h-1 w-1 rounded-full bg-[rgba(55,53,47,0.25)]" />
        <span className="tabular-nums">{time}</span>
      </div>
      <h1 className="mt-4 text-[30px] sm:text-[36px] font-bold leading-[1.1] tracking-tight text-[#37352f]">
        {greetingFor(hour)}{userName ? `, ${userName}` : ''}
      </h1>
      <p className="mt-2 text-[15px] text-[#787774]">
        Elige la compañía con la que vas a registrar horas.
      </p>
    </div>
  )
}

interface RunningBannerProps {
  readonly running: RunningShift
  readonly receivedAt: number
  readonly company: Company | null
  readonly opening: boolean
  readonly onOpen: () => void
}

function RunningBanner({ running, receivedAt, company, opening, onOpen }: RunningBannerProps) {
  const now = useNow(1000)
  const elapsed = running.isPaused
    ? running.elapsedSeconds
    : running.elapsedSeconds + Math.max(0, Math.floor((now - receivedAt) / 1000))
  const color = company?.color ?? '#10b981'

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative mt-8 w-full overflow-hidden rounded-2xl bg-[#1f1e1c] p-5 sm:p-6 text-left text-white shadow-[0_18px_40px_-20px_rgba(15,15,15,0.6)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-20px_rgba(15,15,15,0.7)] animate-card-in touch-manipulation"
      style={{ animationDelay: '60ms' }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: color }} />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full blur-3xl opacity-[0.18]"
        style={{ backgroundColor: running.isPaused ? '#dfab01' : '#10b981' }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider">
            {running.isPaused ? (
              <>
                <Pause className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-amber-300">Turno en pausa</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-emerald-300">Turno en curso</span>
              </>
            )}
            {company && <span className="truncate normal-case tracking-normal text-white/60">· {company.name}</span>}
          </div>
          <div className="mt-2 font-[family-name:var(--font-geist-mono)] text-[40px] sm:text-[48px] font-semibold leading-none tabular-nums tracking-tight">
            {formatDuration(elapsed)}
          </div>
          <div className="mt-2 text-[13px] text-white/60">
            Empezó a las {formatTime12(running.startTime)}
            {running.jobNumber ? ` · Trabajo #${running.jobNumber}` : ''}
          </div>
        </div>
        <span className="inline-flex items-center justify-center gap-2 self-start sm:self-auto rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold text-[#1f1e1c] transition-transform duration-200 group-hover:translate-x-0.5">
          {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continuar turno
          {opening ? null : <ArrowRight className="h-4 w-4" />}
        </span>
      </div>
    </button>
  )
}

interface WeekBarsProps {
  readonly days: CompanyWeek['days']
  readonly today: string
  readonly color: string
}

// Horas de cada día de la semana de pago; hoy resaltado y los días por venir vacíos
function WeekBars({ days, today, color }: WeekBarsProps) {
  const scale = Math.max(8 * 3600, ...days.map(d => d.seconds))
  return (
    <div className="flex items-end gap-1.5" aria-hidden>
      {days.map(day => {
        const weekday = dateKeyToUTC(day.date).getUTCDay()
        const isToday = day.date === today
        const isFuture = day.date > today
        const height = day.seconds > 0 ? Math.max(10, (day.seconds / scale) * 100) : 0
        return (
          <div key={day.date} className="group/bar relative flex flex-1 flex-col items-center gap-1.5">
            <span className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-md bg-[#37352f] px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover/bar:opacity-100">
              {DAY_NAMES[weekday].slice(0, 3)} · {day.seconds > 0 ? formatHM(day.seconds) : '—'}
            </span>
            <div className={`relative h-11 w-full overflow-hidden rounded-md ${isFuture ? 'bg-[rgba(55,53,47,0.03)]' : 'bg-[rgba(55,53,47,0.06)]'}`}>
              <div
                className="absolute inset-x-0 bottom-0 rounded-md transition-[height] duration-500 ease-out"
                style={{ height: `${height}%`, backgroundColor: color, opacity: isToday ? 1 : 0.45 }}
              />
            </div>
            <span className={`text-[10px] leading-none ${isToday ? 'font-bold text-[#37352f]' : 'text-[rgba(55,53,47,0.45)]'}`}>
              {DAY_LETTERS[weekday]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface CompanyCardProps {
  readonly company: Company
  readonly week: CompanyWeek | undefined
  readonly today: string
  /** Turno en curso en esta compañía */
  readonly running: RunningShift | null
  readonly isLastUsed: boolean
  readonly opening: boolean
  readonly index: number
  readonly onOpen: () => void
}

function CompanyCard({ company, week, today, running, isLastUsed, opening, index, onOpen }: CompanyCardProps) {
  const color = company.color
  const isRunning = running !== null
  const rule = ruleFor(company, today)
  // El overtime semanal usa la regla vigente al empezar la semana de pago
  const weekRule = ruleFor(company, week?.start ?? today)
  const weeklyOvertime = weekRule.payType === 'weekly_overtime' ? overtimeRulesOf(weekRule) : null
  const thresholdSeconds = (weeklyOvertime?.thresholdHours ?? 0) * 3600

  let footerLabel = lastWorkedLabel(week?.lastWorkedDate ?? null, today)
  if (running) footerLabel = `En curso desde ${formatTime12(running.startTime)}`
  else if (week && week.todaySeconds > 0) footerLabel = `Hoy: ${formatHM(week.todaySeconds)}`

  let badge: ReactNode = null
  if (isRunning) {
    badge = (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        En curso
      </span>
    )
  } else if (isLastUsed) {
    badge = (
      <span className="rounded-full bg-[rgba(55,53,47,0.06)] px-2 py-0.5 text-[11px] font-medium text-[#787774]">
        Última usada
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Registrar horas en ${company.name}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[rgba(55,53,47,0.09)] bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,15,15,0.04)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[rgba(55,53,47,0.16)] hover:shadow-[0_16px_36px_-16px_rgba(15,15,15,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 animate-card-in touch-manipulation"
      style={{ animationDelay: `${120 + index * 70}ms`, ['--tw-ring-color' as string]: color }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundColor: `${color}22` }}
      />

      {/* Compañía */}
      <div className="relative flex items-start gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-[15px] font-bold shadow-sm transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: color, color: textOn(color) }}
        >
          {initialsOf(company.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-bold text-[#37352f]">{company.name}</h3>
            {badge}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-[#787774]">
            Semana {weekShortLabel(company.weekStartsOn)} · {shortRule(rule)}
          </p>
        </div>
      </div>

      {/* Semana de pago */}
      <div className="relative mb-5 mt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[#787774]">
              Esta semana{week ? ` · ${formatRange(week.start, week.end)}` : ''}
            </div>
            <div className="mt-1 text-[26px] font-bold leading-none tabular-nums tracking-tight text-[#37352f]">
              {week ? formatHM(week.totalSeconds) : '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[#787774]">Ganado</div>
            <div className="mt-1 text-[17px] font-semibold tabular-nums text-[#0f7b6c]">
              {week ? formatCurrency(week.totalPay) : '—'}
            </div>
          </div>
        </div>

        {week && (
          <div className="mt-4">
            <WeekBars days={week.days} today={today} color={color} />
          </div>
        )}

        {week && weeklyOvertime && (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(55,53,47,0.08)]">
              <div
                className={`h-full rounded-full transition-[width] duration-700 ease-out ${week.overtimeSeconds > 0 ? 'bg-amber-500' : ''}`}
                style={{
                  width: `${Math.min(100, (week.totalSeconds / thresholdSeconds) * 100)}%`,
                  backgroundColor: week.overtimeSeconds > 0 ? undefined : color,
                }}
              />
            </div>
            <div className="mt-1.5 text-[11px] text-[#787774]">
              {week.overtimeSeconds > 0 ? (
                <span className="font-semibold text-amber-700">Overtime: {formatHM(week.overtimeSeconds)} a {weeklyOvertime.multiplier}x</span>
              ) : (
                <>Faltan {formatHM(thresholdSeconds - week.totalSeconds)} para overtime</>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Acción */}
      <div className="relative mt-auto flex items-center justify-between gap-3 border-t border-[rgba(55,53,47,0.07)] pt-4">
        <span className="text-[12px] text-[#787774]">{footerLabel}</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#37352f] transition-colors duration-200 bg-[rgba(55,53,47,0.06)] group-hover:text-[color:var(--cta-text)] group-hover:bg-[color:var(--cta-bg)]"
          style={{ ['--cta-bg' as string]: color, ['--cta-text' as string]: textOn(color) }}
        >
          {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isRunning ? 'Ver turno' : 'Registrar horas'}
          {opening ? null : <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />}
        </span>
      </div>
    </button>
  )
}

function CardSkeleton({ index }: { readonly index: number }) {
  return (
    <div
      className="rounded-2xl border border-[rgba(55,53,47,0.09)] bg-white p-5 animate-card-in"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-[rgba(55,53,47,0.08)] animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-1/2 rounded bg-[rgba(55,53,47,0.08)] animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-[rgba(55,53,47,0.06)] animate-pulse" />
        </div>
      </div>
      <div className="mt-6 h-7 w-24 rounded bg-[rgba(55,53,47,0.08)] animate-pulse" />
      <div className="mt-4 h-11 rounded-md bg-[rgba(55,53,47,0.05)] animate-pulse" />
      <div className="mt-5 h-8 rounded-lg bg-[rgba(55,53,47,0.05)] animate-pulse" />
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ModeSelectPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const companies = useCompanies()
  const [overview, setOverview] = useState<Overview | null>(null)
  // Solo se muestra en el cliente (las tarjetas no se renderizan en el servidor)
  const [lastCompanyId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(COMPANY_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [opening, setOpening] = useState<string | null>(null)
  const [manager, setManager] = useState<'closed' | 'list' | 'create'>('closed')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadOverview = useCallback(() => {
    fetch('/api/companies/overview')
      .then(res => res.json())
      .then(json => {
        if (json.success) setOverview({ ...json.data, receivedAt: Date.now() })
      })
      .catch(err => console.error('Error loading overview:', err))
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    loadOverview()
    refreshCompanies().catch(err => console.error('Error loading companies:', err))
    router.prefetch('/dashboard/hourly')
    router.prefetch('/dashboard/payment')
  }, [status, loadOverview, router])

  // Al volver a la app (otra pestaña o desde segundo plano) el resumen se refresca
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && status === 'authenticated') loadOverview()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [status, loadOverview])

  const openCompany = (companyId: string) => {
    setOpening(companyId)
    try {
      localStorage.setItem(MODE_STORAGE_KEY, 'hourly')
      localStorage.setItem(COMPANY_STORAGE_KEY, companyId)
    } catch { /* sin almacenamiento disponible */ }
    router.push(`/dashboard/hourly?company=${encodeURIComponent(companyId)}`)
  }

  const openPaymentMode = () => {
    setOpening('payment')
    try {
      localStorage.setItem(MODE_STORAGE_KEY, 'payment')
    } catch { /* sin almacenamiento disponible */ }
    router.push('/dashboard/payment')
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || ''
  const firstName = userName.split(/\s+/)[0]
  const activeCompanies = companies?.filter(c => !c.archived) ?? null
  const today = overview?.today ?? getFloridaDateString()
  const running = overview?.running ?? null
  const runningCompany = running
    ? activeCompanies?.find(c => c.id === running.companyId) ?? activeCompanies?.[0] ?? null
    : null
  const loading = status !== 'authenticated' || activeCompanies === null

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#fbfbfa] font-notion">
      {/* Halo de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[460px]"
        style={{ background: 'radial-gradient(70% 90% at 50% -10%, rgba(16,185,129,0.12), rgba(16,185,129,0) 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[460px] opacity-[0.35]"
        style={{
          backgroundImage: 'linear-gradient(rgba(55,53,47,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(55,53,47,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(60% 70% at 50% 0%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(60% 70% at 50% 0%, black, transparent)',
        }}
      />

      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-[rgba(55,53,47,0.07)] bg-[#fbfbfa]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#37352f] shadow-sm">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-[#37352f]">Meditron</span>
          </div>
          <div className="flex items-center gap-2">
            {userName && (
              <div className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#37352f] text-[11px] font-bold text-white">
                  {initialsOf(userName)}
                </span>
                <span className="hidden text-[13px] font-medium text-[#37352f] sm:inline">{userName}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.08)] hover:text-[#37352f]"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 pb-16 pt-10 sm:pt-14">
        {status === 'authenticated' ? (
          <TodayHeader userName={firstName} />
        ) : (
          <div className="space-y-3">
            <div className="h-6 w-48 rounded-full bg-[rgba(55,53,47,0.06)] animate-pulse" />
            <div className="h-9 w-72 rounded bg-[rgba(55,53,47,0.08)] animate-pulse" />
          </div>
        )}

        {running && overview && (
          <RunningBanner
            running={running}
            receivedAt={overview.receivedAt}
            company={runningCompany}
            opening={runningCompany !== null && opening === runningCompany.id}
            onOpen={() => runningCompany && openCompany(runningCompany.id)}
          />
        )}

        {/* Compañías */}
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#787774]">Tus compañías</h2>
            <button
              type="button"
              onClick={() => setManager('list')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[#37352f] transition-colors hover:bg-[rgba(55,53,47,0.08)] disabled:opacity-40"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configurar
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {loading || activeCompanies === null ? (
              <>
                <CardSkeleton index={0} />
                <CardSkeleton index={1} />
              </>
            ) : (
              <>
                {activeCompanies.map((company, index) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    week={overview?.companies.find(w => w.companyId === company.id)}
                    today={today}
                    running={runningCompany?.id === company.id ? running : null}
                    isLastUsed={lastCompanyId === company.id}
                    opening={opening === company.id}
                    index={index}
                    onOpen={() => openCompany(company.id)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setManager('create')}
                  className="group flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[rgba(55,53,47,0.14)] p-5 text-center transition-[border-color,background-color] duration-200 hover:border-[rgba(55,53,47,0.35)] hover:bg-white animate-card-in touch-manipulation"
                  style={{ animationDelay: `${120 + activeCompanies.length * 70}ms` }}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(55,53,47,0.06)] text-[#787774] transition-[transform,background-color,color] duration-200 group-hover:rotate-90 group-hover:bg-[#37352f] group-hover:text-white">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold text-[#37352f]">Agregar compañía</span>
                    <span className="mt-0.5 block text-[12px] text-[#787774]">Con su tarifa, overtime y semana de pago</span>
                  </span>
                </button>
              </>
            )}
          </div>
        </section>

        {/* Otro modo */}
        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#787774]">Otro modo</h2>
          <button
            type="button"
            onClick={openPaymentMode}
            className="group flex w-full items-center gap-4 rounded-2xl border border-[rgba(55,53,47,0.09)] bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,15,15,0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(15,15,15,0.25)] animate-card-in touch-manipulation"
            style={{ animationDelay: '320ms' }}
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(15,123,108,0.1)] text-[#0f7b6c] transition-transform duration-200 group-hover:scale-105">
              <DollarSign className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-[#37352f]">Por pago</span>
              <span className="mt-0.5 block text-[13px] text-[#787774]">Registra el tiempo e ingresa el monto al terminar cada trabajo</span>
            </span>
            {opening === 'payment' ? (
              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-[#787774]" />
            ) : (
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-[#787774] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#37352f]" />
            )}
          </button>
        </section>
      </main>

      {manager !== 'closed' && companies && (
        <CompanyManager
          companies={companies}
          startCreating={manager === 'create'}
          onClose={() => setManager('closed')}
          onChanged={loadOverview}
        />
      )}
    </div>
  )
}
