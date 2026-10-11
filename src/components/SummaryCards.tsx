'use client'

import { useState, type ReactNode } from 'react'
import { formatDuration, formatCurrency, getMonthName, formatDateInFlorida } from '@/lib/utils'
import { overtimeRulesOf, ruleFor, type Company } from '@/lib/companies'
import { formatKeyShort } from '@/lib/report-format'
import { formatHM } from '@/lib/display'
import { Calendar, Clock, DollarSign, TrendingUp, Pencil, Check, X, Flame } from 'lucide-react'

interface DaySummary {
  date: string
  totalSeconds: number
  earnings: number
}

/** Semana de pago actual de la compañía */
interface PayWeekSummary {
  start: string
  end: string
  /** Número de semana ISO (solo para semanas de lunes a domingo) */
  weekNumber: number | null
  totalSeconds: number
  overtimeSeconds: number
  earnings: number
}

interface MonthSummaryData {
  year: number
  month: number
  totalSeconds: number
  earnings: number
}

interface SummaryCardsProps {
  readonly company: Company
  readonly today: DaySummary
  readonly currentWeek: PayWeekSummary
  readonly monthSummary: MonthSummaryData
  /** Hay un turno de esta compañía en curso: sus horas se suman al detenerlo */
  readonly runningHere?: boolean
  /** Guarda la tarifa de la compañía; devuelve un error o null */
  readonly onSaveRate: (rate: number) => Promise<string | null>
}

const cardClass = 'rounded-xl border border-[rgba(55,53,47,0.09)] bg-white px-4 py-4 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md touch-manipulation select-none'
const valueClass = 'text-[22px] sm:text-[26px] font-bold text-[#37352f] leading-tight tabular-nums'

function CardTitle({ icon, tint, label, children }: { readonly icon: ReactNode; readonly tint: string; readonly label: string; readonly children?: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[#787774] mb-3 min-w-0">
      <div className={`p-1.5 rounded-lg ${tint}`}>{icon}</div>
      <span className="text-[12px] font-medium uppercase tracking-wide truncate">{label}</span>
      {children}
    </div>
  )
}

function formatRate(n: number): string {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`
}

/** Avance hacia el overtime semanal dentro de la tarjeta de la semana */
function WeekOvertime({ week, thresholdHours }: { readonly week: PayWeekSummary; readonly thresholdHours: number }) {
  const threshold = thresholdHours * 3600
  const inOvertime = week.overtimeSeconds > 0
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full bg-[rgba(55,53,47,0.08)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${inOvertime ? 'bg-[#d9730d]' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(100, (week.totalSeconds / threshold) * 100)}%` }}
        />
      </div>
      <div className={`mt-1 flex items-center gap-1 text-[11px] ${inOvertime ? 'font-semibold text-[#9a4a0b]' : 'text-[#787774]'}`}>
        {inOvertime && <Flame className="h-3 w-3" />}
        {inOvertime ? `${formatHM(week.overtimeSeconds)} de overtime` : `Faltan ${formatHM(threshold - week.totalSeconds)} para OT`}
      </div>
    </div>
  )
}

export function SummaryCards({ company, today, currentWeek, monthSummary, runningHere = false, onSaveRate }: Readonly<SummaryCardsProps>) {
  const rule = ruleFor(company, today.date)
  const rateOvertime = overtimeRulesOf(rule)
  // El overtime de la semana sigue la regla vigente al empezar la semana de pago
  const weekRule = ruleFor(company, currentWeek.start)
  const weeklyOvertime = weekRule.payType === 'weekly_overtime' ? overtimeRulesOf(weekRule) : null

  const [isEditingRate, setIsEditingRate] = useState(false)
  const [tempRate, setTempRate] = useState(String(rule.hourlyRate))
  const [isSaving, setIsSaving] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)

  const handleSaveRate = async () => {
    const newRate = Number.parseFloat(tempRate)
    if (Number.isNaN(newRate) || newRate <= 0) {
      setRateError('Tarifa inválida')
      return
    }
    setIsSaving(true)
    const saveError = await onSaveRate(newRate)
    setIsSaving(false)
    setRateError(saveError)
    if (!saveError) setIsEditingRate(false)
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Hoy */}
      <div className={cardClass}>
        <CardTitle icon={<Clock className="h-3.5 w-3.5 text-blue-500" />} tint="bg-blue-50" label="Hoy" />
        <div className={valueClass}>{formatDuration(today.totalSeconds)}</div>
        <div className="text-[15px] font-semibold text-emerald-600 mt-1 tabular-nums">{formatCurrency(today.earnings)}</div>
        {runningHere ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            + turno en curso
          </div>
        ) : (
          <div className="text-[11px] text-[#787774] mt-1.5 hidden sm:block">
            {formatDateInFlorida(today.date, { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
        )}
      </div>

      {/* Semana de pago */}
      <div className={cardClass}>
        <CardTitle icon={<Calendar className="h-3.5 w-3.5 text-emerald-500" />} tint="bg-emerald-50" label="Semana">
          {currentWeek.weekNumber !== null && (
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] rounded-md font-mono font-bold">
              {currentWeek.weekNumber}
            </span>
          )}
        </CardTitle>
        <div className={valueClass}>{(currentWeek.totalSeconds / 3600).toFixed(2)}h</div>
        <div className="text-[15px] font-semibold text-emerald-600 mt-1 tabular-nums">{formatCurrency(currentWeek.earnings)}</div>
        {weeklyOvertime && <WeekOvertime week={currentWeek} thresholdHours={weeklyOvertime.thresholdHours} />}
        <div className="text-[11px] text-[#787774] mt-1.5 hidden sm:block">
          {formatKeyShort(currentWeek.start)} → {formatKeyShort(currentWeek.end)}
        </div>
      </div>

      {/* Mes calendario */}
      <div className={cardClass}>
        <CardTitle icon={<TrendingUp className="h-3.5 w-3.5 text-purple-500" />} tint="bg-purple-50" label={getMonthName(monthSummary.month)} />
        <div className={valueClass}>{(monthSummary.totalSeconds / 3600).toFixed(2)}h</div>
        <div className="text-[15px] font-semibold text-emerald-600 mt-1 tabular-nums">{formatCurrency(monthSummary.earnings)}</div>
        <div className="text-[11px] text-[#787774] mt-1.5 hidden sm:block">Total del mes</div>
      </div>

      {/* Tarifa (editable: crea una versión nueva desde esta semana) */}
      <div className={cardClass}>
        <CardTitle icon={<DollarSign className="h-3.5 w-3.5 text-amber-500" />} tint="bg-amber-50" label="Tarifa">
          {!isEditingRate && (
            <button
              type="button"
              onClick={() => {
                setTempRate(String(rule.hourlyRate))
                setRateError(null)
                setIsEditingRate(true)
              }}
              aria-label="Editar tarifa"
              className="ml-auto p-1 text-[#787774] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] rounded-[3px] transition-colors touch-manipulation"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </CardTitle>
        {isEditingRate ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-[13px] text-[#787774]">$</span>
              <input
                type="number"
                value={tempRate}
                onChange={(e) => setTempRate(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRate() }}
                className="w-full max-w-[80px] px-2 py-1 text-[14px] font-semibold text-[#37352f] border border-[rgba(55,53,47,0.16)] rounded-[4px] focus:outline-none focus:border-[#37352f]"
                style={{ fontSize: '16px' }}
                step="0.01"
                min="0"
                autoFocus
              />
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleSaveRate}
                disabled={isSaving}
                aria-label="Guardar tarifa"
                className="flex-1 py-1 text-[12px] bg-[#37352f] text-white rounded-[4px] hover:bg-[#2f2d28] disabled:opacity-60 transition-colors flex items-center justify-center touch-manipulation"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingRate(false)}
                aria-label="Cancelar"
                className="flex-1 py-1 text-[12px] text-[#787774] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] rounded-[4px] transition-colors flex items-center justify-center touch-manipulation"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-[10px] leading-snug text-[#9b9a97]">Aplica desde esta semana; las anteriores no cambian.</p>
            {rateError && <p className="text-[11px] text-red-600">{rateError}</p>}
          </div>
        ) : (
          <>
            <div className={valueClass}>{formatRate(rule.hourlyRate)}</div>
            <div className="text-[11px] text-[#787774] mt-0.5">USD/hr</div>
            {rateOvertime && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#fbecdd] px-1.5 py-0.5 text-[10px] font-semibold text-[#9a4a0b]">
                <Flame className="h-2.5 w-2.5" />
                OT {rateOvertime.multiplier}x · {rateOvertime.thresholdHours}h/{rule.payType === 'daily_overtime' ? 'día' : 'sem'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
