'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDuration, getMonthName, parseLocalDate, formatTimeInFlorida, formatShortDateFlorida, formatLongDateFlorida, getFloridaDateString } from '@/lib/utils'
import { Calendar, ChevronDown, ChevronRight, ChevronLeft, Printer, CheckCircle2, AlertTriangle, BadgeCheck, Hourglass } from 'lucide-react'
import { getPayPeriod, toDateKey } from '@/lib/companies'
import { weekPayStatus, type WeekPayStatus } from '@/lib/week-payments'
import type { PayFilter } from './PayWeeks'
import { PayStatusPill } from './WeekPayment'
import { Button } from '@/components/ui/button'
import { EntryList } from './EntryList'
import { WeeklyPdfButton } from './WeeklyPdfButton'

// Texto del usuario dentro del HTML de impresión: se escapa para que no se interprete como código
function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

const ITEMS_PER_PAGE = 5

interface Entry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
  jobNumber?: string | null
  vehicle?: string | null
  calculatedAmount?: number | null
  paidAmount?: number | null
  companyPaid?: number | null
  correctionPending?: boolean
  correctionNote?: string | null
  correctionResolved?: boolean
  correctionResolvedNote?: string | null
}

interface WeekData {
  id: string
  weekNumber: number
  year: number
  month: number
  startDate: string
  endDate: string
  totalHours: number
  earnings: number
  entries: Entry[]
}

interface WeekHistoryProps {
  readonly onRefresh?: () => void
  readonly refreshTrigger?: number
  /** Solo las semanas y trabajos de esta compañía */
  readonly companyId?: string
  /** La compañía anota lo que pagó en cada trabajo: se muestra lo que falta cobrar */
  readonly trackCompanyPaid?: boolean
  readonly initialFilter?: PayFilter
}

/** Monto de un trabajo según la app (el guardado o, si no hay, por la tarifa) */
function entryAmount(entry: Entry, hourlyRate: number): number {
  return entry.calculatedAmount ?? ((entry.duration ?? 0) / 3600) * hourlyRate
}

/**
 * Cobro de la semana (de lunes a domingo) con lo que la empresa pagó en cada
 * trabajo: lo mismo que calcula el aviso "te debe" del panel.
 */
function weekStatus(week: WeekData, hourlyRate: number, today: string): WeekPayStatus | null {
  const completed = week.entries.filter(e => e.duration !== null && e.endTime !== null)
  if (completed.length === 0) return null
  const jobs = completed.map(e => ({ amount: entryAmount(e, hourlyRate), companyPaid: e.companyPaid ?? null }))
  const { end } = getPayPeriod(toDateKey(completed[0].date), 1)
  const totalPay = jobs.reduce((sum, job) => sum + job.amount, 0)
  return weekPayStatus({ end, totalPay, totalSeconds: 0, payment: null, entries: jobs }, today, { byJob: true })
}

const isOwedState = (status: WeekPayStatus | null) => status?.state === 'owed' || status?.state === 'short'
const isPaidState = (status: WeekPayStatus | null) => status?.state === 'paid' || status?.state === 'short' || status?.state === 'over'

/** Lo que falta cobrar de la semana, con el monto */
function OwedPill({ status }: { readonly status: WeekPayStatus }) {
  if (status.state === 'short') return <PayStatusPill status={status} />
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
      <Hourglass className="h-2.5 w-2.5" />
      POR COBRAR {formatCurrency(status.owed)}
    </span>
  )
}

export function WeekHistory({ onRefresh, refreshTrigger = 0, companyId, trackCompanyPaid = false, initialFilter = 'all' }: Readonly<WeekHistoryProps>) {
  const [filter, setFilter] = useState<PayFilter>(trackCompanyPaid ? initialFilter : 'all')
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [hourlyRate, setHourlyRate] = useState<number>(25)

  const fetchWeeks = async () => {
    try {
      const [weeksRes, dashboardRes] = await Promise.all([
        fetch(companyId ? `/api/weeks?companyId=${encodeURIComponent(companyId)}` : '/api/weeks'),
        fetch(companyId ? `/api/dashboard?companyId=${encodeURIComponent(companyId)}` : '/api/dashboard')
      ])
      const weeksData = await weeksRes.json()
      const dashboardData = await dashboardRes.json()
      
      if (weeksData.success) {
        setWeeks(weeksData.data)
      }
      if (dashboardData.success) {
        setHourlyRate(dashboardData.data.hourlyRate || 25)
      }
    } catch (error) {
      console.error('Error fetching weeks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWeeks()
  }, [refreshTrigger, companyId])

  const handleEntryDelete = () => {
    fetchWeeks()
    if (onRefresh) onRefresh()
  }

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Historial de Semanas - Meditron</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #333; }
          h1 { color: #059669; font-size: 24px; margin-bottom: 8px; }
          .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
          .week { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px; page-break-inside: avoid; }
          .week-header { background: linear-gradient(to right, #ecfdf5, #d1fae5); padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
          .week-title { font-weight: 600; font-size: 16px; color: #065f46; }
          .week-dates { font-size: 12px; color: #6b7280; margin-top: 4px; }
          .week-summary { display: flex; justify-content: space-between; padding: 12px 16px; background: #f9fafb; }
          .summary-item { text-align: center; }
          .summary-label { font-size: 11px; color: #6b7280; }
          .summary-value { font-size: 18px; font-weight: 700; color: #059669; }
          .entries { padding: 12px 16px; }
          .entry { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .entry:last-child { border-bottom: none; }
          .entry-date { font-size: 13px; color: #374151; }
          .entry-time { font-size: 12px; color: #6b7280; }
          .entry-duration { font-size: 14px; font-weight: 600; color: #1f2937; }
          .entry-earnings { font-size: 14px; font-weight: 600; color: #059669; }
          .job-badge { background: linear-gradient(to right, #3b82f6, #4f46e5); color: white; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; }
          .total-section { margin-top: 24px; padding: 16px; background: linear-gradient(to right, #059669, #10b981); color: white; border-radius: 8px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .total-label { font-size: 14px; opacity: 0.9; }
          .total-value { font-size: 20px; font-weight: 700; }
          @media print { body { padding: 0; } .week { break-inside: avoid; } }
        </style>
      </head>
      <body>
        <h1>📊 Historial de Semanas</h1>
        <p class="subtitle">Control de Horas - Meditron | Generado: ${formatLongDateFlorida(new Date())}</p>
        
        ${weeks.map(week => `
          <div class="week">
            <div class="week-header">
              <div class="week-title">📅 Semana ${week.weekNumber} - ${getMonthName(week.month)} ${week.year}</div>
              <div class="week-dates">Lun ${parseLocalDate(week.startDate).getDate()} → Dom ${parseLocalDate(week.endDate).getDate()}</div>
            </div>
            <div class="week-summary">
              <div class="summary-item">
                <div class="summary-label">Horas</div>
                <div class="summary-value">${week.totalHours.toFixed(1)}h</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Ganancias</div>
                <div class="summary-value">${formatCurrency(week.earnings)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Entradas</div>
                <div class="summary-value">${week.entries.length}</div>
              </div>
            </div>
            <div class="entries">
              ${week.entries.map(entry => `
                <div class="entry">
                  <div>
                    <div class="entry-date">
                      ${formatShortDateFlorida(entry.date)}
                      ${entry.jobNumber ? `<span class="job-badge">#${escapeHtml(entry.jobNumber)}</span>` : ''}
                    </div>
                    <div class="entry-time">
                      ${formatTimeInFlorida(entry.startTime)}
                      → ${entry.endTime ? formatTimeInFlorida(entry.endTime) : 'En curso'}
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div class="entry-duration">${entry.duration ? formatDuration(entry.duration) : '-'}</div>
                    <div class="entry-earnings">${entry.duration ? formatCurrency((entry.duration / 3600) * hourlyRate) : '-'}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
        
        <div class="total-section">
          <div class="total-row">
            <span class="total-label">Total Horas:</span>
            <span class="total-value">${weeks.reduce((sum, w) => sum + w.totalHours, 0).toFixed(1)}h</span>
          </div>
          <div class="total-row">
            <span class="total-label">Total Ganancias:</span>
            <span class="total-value">${formatCurrency(weeks.reduce((sum, w) => sum + w.earnings, 0))}</span>
          </div>
        </div>
      </body>
      </html>
    `

    printWindow.document.documentElement.innerHTML = content
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  // Lo que falta cobrar (solo si la compañía anota lo que paga en cada trabajo)
  const today = getFloridaDateString()
  const statuses = new Map(weeks.map(week => [week.id, trackCompanyPaid ? weekStatus(week, hourlyRate, today) : null]))
  const owedWeeks = weeks.filter(week => isOwedState(statuses.get(week.id) ?? null))
  const paidCount = weeks.filter(week => isPaidState(statuses.get(week.id) ?? null)).length
  const owedTotal = owedWeeks.reduce((sum, week) => sum + (statuses.get(week.id)?.owed ?? 0), 0)
  const showFilter = trackCompanyPaid && (owedWeeks.length > 0 || paidCount > 0)
  const filteredWeeks = weeks.filter(week => {
    const status = statuses.get(week.id) ?? null
    if (filter === 'owed') return isOwedState(status)
    if (filter === 'paid') return isPaidState(status)
    return true
  })
  const filters: { value: PayFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'owed', label: owedWeeks.length > 0 ? `Por cobrar (${owedWeeks.length})` : 'Por cobrar' },
    { value: 'paid', label: 'Pagadas' },
  ]

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredWeeks.length / ITEMS_PER_PAGE))
  const page = Math.min(currentPage, totalPages)
  const startIndex = (page - 1) * ITEMS_PER_PAGE
  const paginatedWeeks = filteredWeeks.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de Semanas
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

  if (weeks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de Semanas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No hay semanas registradas
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Historial de Semanas
            <span className="text-xs font-normal text-gray-500">({weeks.length})</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 touch-manipulation"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Imprimir todo</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {showFilter && (
          <div className="mb-3 space-y-2">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-[rgba(55,53,47,0.06)] p-1" role="tablist" aria-label="Filtrar semanas">
              {filters.map(f => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => { setFilter(f.value); setCurrentPage(1) }}
                  className={`rounded-lg py-1.5 text-[12px] font-semibold transition-all touch-manipulation ${filter === f.value ? 'bg-white text-[#37352f] shadow-sm' : 'text-[#787774] hover:text-[#37352f]'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {filter === 'owed' && owedWeeks.length > 0 && (
              <>
                <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                  <span>Falta cobrar</span>
                  <span className="font-bold tabular-nums">{formatCurrency(owedTotal)}</span>
                </div>
                <p className="px-1 text-[12px] text-[#787774]">
                  Abre la semana y anota en cada trabajo lo que te pagó la empresa.
                </p>
              </>
            )}
          </div>
        )}
        {filteredWeeks.length === 0 && (
          <div className="py-6 text-center text-[13px] text-[#787774]">
            {filter === 'owed' ? '¡Todo cobrado! No hay trabajos pendientes de pago.' : 'Todavía no hay semanas con todos sus trabajos pagados.'}
          </div>
        )}
        <div className="space-y-2">
          {paginatedWeeks.map((week) => {
            const payStatus = statuses.get(week.id) ?? null
            const owedPill = payStatus && isOwedState(payStatus) ? <OwedPill status={payStatus} /> : null
            const completedEntries = week.entries.filter(e => e.duration !== null)
            const paidEntryCount = completedEntries.filter(e => e.companyPaid != null && e.companyPaid > 0).length
            const allPaid = paidEntryCount === completedEntries.length && completedEntries.length > 0
            const hasPendingCorrections = completedEntries.some(e => e.correctionPending)
            const hasResolvedCorrections = completedEntries.some(e => e.correctionResolved)
            // Timer sin detener: la semana existe pero sus horas aún no cuentan
            const runningEntry = week.entries.find(e => e.endTime === null)

            let statusBadge: React.ReactNode
            if (hasPendingCorrections) {
              statusBadge = (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  CORRECCIÓN
                </span>
              )
            } else if (hasResolvedCorrections) {
              statusBadge = (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-300">
                  <BadgeCheck className="h-2.5 w-2.5" />
                  CORREGIDO
                </span>
              )
            } else if (owedPill) {
              // Lo que falta cobrar ya lo dice su propia etiqueta
              statusBadge = null
            } else if (allPaid) {
              statusBadge = (
                <span className="relative inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow overflow-hidden">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  REVISADO
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </span>
              )
            } else if (completedEntries.length === 0) {
              // Nada terminado todavía: no hay nada que revisar
              statusBadge = null
            } else {
              statusBadge = (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
                  SIN REVISAR
                </span>
              )
            }

            return (
            <div key={week.id} className={`rounded-xl overflow-hidden transition-all duration-200 ${expandedWeek === week.id ? 'bg-white shadow-md ring-2 ring-emerald-400' : 'bg-gray-50 shadow-sm ring-1 ring-gray-200'}`}>
              <Button
                variant="ghost"
                className={`w-full justify-between p-3 sm:p-4 h-auto transition-all touch-manipulation active:scale-[0.98] ${expandedWeek === week.id ? 'bg-emerald-50 hover:bg-emerald-50' : 'hover:bg-gray-100'}`}
                onClick={() => setExpandedWeek(expandedWeek === week.id ? null : week.id)}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {expandedWeek === week.id ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                  <div className="text-left min-w-0">
                    <div className="font-semibold text-sm sm:text-base truncate flex items-center gap-1.5 flex-wrap">
                      Sem {week.weekNumber} - {getMonthName(week.month)}
                      {statusBadge}
                      {owedPill}
                      {runningEntry && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          EN CURSO{runningEntry.jobNumber ? ` #${runningEntry.jobNumber}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 flex flex-wrap items-center gap-1">
                      <span className="bg-blue-100 text-blue-700 px-1 sm:px-1.5 py-0.5 rounded font-medium">
                        {parseLocalDate(week.startDate).getDate()}
                      </span>
                      <span>→</span>
                      <span className="bg-green-100 text-green-700 px-1 sm:px-1.5 py-0.5 rounded font-medium">
                        {parseLocalDate(week.endDate).getDate()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-sm sm:text-base">{week.totalHours.toFixed(1)}h</div>
                  <div className="text-green-600 font-semibold text-sm sm:text-base">
                    {formatCurrency(week.entries.filter(e => e.duration !== null).reduce((s, e) => s + (e.calculatedAmount ?? ((e.duration ?? 0) / 3600 * hourlyRate)), 0))}
                  </div>
                </div>
              </Button>
              
              {expandedWeek === week.id && week.entries.length > 0 && (
                <div className="p-3 sm:p-4 pt-0 border-t bg-gray-50">
                  {companyId && (
                    <div className="mt-3 flex justify-end">
                      <WeeklyPdfButton companyId={companyId} date={week.startDate} label="PDF de la semana" />
                    </div>
                  )}
                  <div className="mt-3">
                    <EntryList
                      entries={week.entries}
                      title={`Entradas de la Semana ${week.weekNumber}`}
                      showDate
                      onDelete={handleEntryDelete}
                      onUpdate={() => { fetchWeeks(); onRefresh?.(); }}
                      hourlyRate={hourlyRate}
                    />
                  </div>
                </div>
              )}
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
              onClick={() => setCurrentPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 touch-manipulation"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 touch-manipulation"
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
