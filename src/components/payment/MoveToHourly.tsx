'use client'

import { useState } from 'react'
import { AlertTriangle, ArrowRightLeft, Check, Clock, Info, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatKeyShort, formatTime12 } from '@/lib/report-format'
import { formatHM } from '@/lib/display'
import { describeRule, ruleFor, type Company } from '@/lib/companies'
import { jobEarned, jobTitle, type PaymentJob } from '@/lib/payment-jobs'
import {
  companyPaidFor, hourlyAmountFor, plainHourlyOn,
  type DuplicateMode, type MoveAmount, type MoveDuplicate, type MoveResult,
} from '@/lib/move-to-hourly'
import { useCompanies } from '@/hooks/useCompanies'

// Pasar uno o varios trabajos de Por Pago a una compañía de Por Hora: se
// elige la compañía, cómo queda el monto y si se anota lo que ya te pagaron.

interface MoveToHourlyProps {
  readonly jobs: PaymentJob[]
  readonly onDone: (result: MoveResult) => void
  readonly onCancel: () => void
}

/** La compañía que más probablemente es: la del mismo nombre o la que anota # de trabajo */
function suggestedCompany(companies: Company[], jobs: PaymentJob[]): Company | null {
  const names = new Set(jobs.map(j => j.company?.name.trim().toLowerCase()).filter(Boolean))
  const sameName = companies.find(c => names.has(c.name.trim().toLowerCase()))
  if (sameName) return sameName
  if (jobs.some(j => j.jobNumber)) {
    const tracking = companies.find(c => c.trackJobNumber)
    if (tracking) return tracking
  }
  return companies[0] ?? null
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export function MoveToHourly({ jobs, onDone, onCancel }: MoveToHourlyProps) {
  const all = useCompanies()
  const companies = (all ?? []).filter(c => !c.archived)
  const [picked, setPicked] = useState<string | null>(null)
  const [amountMode, setAmountMode] = useState<MoveAmount>('rate')
  const [markPaid, setMarkPaid] = useState(true)
  const [busy, setBusy] = useState<DuplicateMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<MoveDuplicate[] | null>(null)

  const company = companies.find(c => c.id === picked) ?? suggestedCompany(companies, jobs)
  const single = jobs.length === 1 ? jobs[0] : null
  const seconds = jobs.reduce((sum, j) => sum + j.duration, 0)
  const earned = jobs.reduce((sum, j) => sum + jobEarned(j), 0)
  const paidJobs = jobs.filter(j => companyPaidFor(j) !== null)
  const paidTotal = paidJobs.reduce((sum, j) => sum + (companyPaidFor(j) ?? 0), 0)
  const pendingCount = jobs.filter(j => j.paymentStatus === 'pending').length
  // Con overtime el monto lo calcula la compañía (no se puede escribir)
  const canKeep = company ? jobs.every(j => plainHourlyOn(company, j.date)) : false
  const mode: MoveAmount = canKeep ? amountMode : 'rate'
  const rateTotal = company ? jobs.reduce((sum, j) => sum + hourlyAmountFor(company, j, 'rate'), 0) : 0
  const showMarkPaid = Boolean(company?.trackCompanyPaid) && paidJobs.length > 0

  const send = async (duplicatesMode: DuplicateMode) => {
    if (!company) return
    setBusy(duplicatesMode)
    setError(null)
    try {
      const res = await fetch('/api/payment/jobs/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: jobs.map(j => j.id), companyId: company.id, amount: mode, markPaid, duplicates: duplicatesMode }),
      })
      const json = await res.json()
      if (res.status === 409 && json.data?.duplicates) {
        setDuplicates(json.data.duplicates as MoveDuplicate[])
        return
      }
      if (!json.success) throw new Error(json.error || 'No se pudieron pasar')
      onDone(json.data as MoveResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setBusy(null)
    }
  }

  if (all === null) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#9b9a97]" /></div>
  }

  if (companies.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-[14px] text-[#37352f]">No tienes compañías de Por Hora todavía. Crea una desde la pantalla principal y vuelve aquí.</p>
        <button type="button" onClick={onCancel} className="w-full rounded-xl border border-[rgba(55,53,47,0.16)] py-3 text-[14px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.05)]">Volver</button>
      </div>
    )
  }

  if (duplicates) {
    return (
      <DuplicatesStep
        duplicates={duplicates}
        total={jobs.length}
        busy={busy}
        error={error}
        onChoose={send}
        onBack={() => { setDuplicates(null); setError(null) }}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Por qué está aquí */}
      <div className="flex gap-3 rounded-xl bg-[#eef4fb] p-3.5 text-[13px] leading-relaxed text-[#1f4f82]">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          Antes el cronómetro de Por Pago pedía # de trabajo y vehículo, por eso algunos trabajos de Por Hora quedaron guardados aquí.
          Al pasarlo{single ? '' : 's'} se crea{single ? '' : 'n'} el registro{single ? '' : 's'} en Por Hora con sus horas, número y vehículo, y se quita{single ? '' : 'n'} de Por Pago.
        </p>
      </div>

      {/* Qué se mueve */}
      <div className="rounded-xl border border-[rgba(55,53,47,0.09)] px-4 py-3">
        {single ? (
          <>
            <div className="text-[14px] font-semibold text-[#37352f]">{jobTitle(single)}</div>
            <div className="mt-0.5 text-[12px] text-[#787774] tabular-nums">
              {formatKeyShort(single.date)} · {formatTime12(single.startTime)} → {formatTime12(single.endTime)} · {formatHM(single.duration)} · {formatCurrency(earned)}
            </div>
          </>
        ) : (
          <>
            <div className="text-[14px] font-semibold text-[#37352f]">{plural(jobs.length, 'trabajo', 'trabajos')}</div>
            <div className="mt-0.5 text-[12px] text-[#787774] tabular-nums">
              {formatHM(seconds)} · {formatCurrency(earned)} en Por Pago{pendingCount > 0 ? ` · ${pendingCount} por cobrar` : ''}
            </div>
          </>
        )}
      </div>

      {/* Compañía */}
      <fieldset>
        <legend className="text-[12px] font-semibold text-[#37352f]">¿A qué compañía de Por Hora?</legend>
        <div className="mt-2 space-y-2">
          {companies.map(c => {
            const active = c.id === company?.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setPicked(c.id)}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors touch-manipulation ${active ? 'border-[#37352f] bg-[rgba(55,53,47,0.04)]' : 'border-[rgba(55,53,47,0.12)] hover:bg-[rgba(55,53,47,0.03)]'}`}
              >
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[#37352f]">{c.name}</span>
                  <span className="block truncate text-[12px] text-[#787774]">{describeRule(ruleFor(c, single?.date ?? jobs[jobs.length - 1].date))}</span>
                </span>
                <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${active ? 'border-[#37352f] bg-[#37352f] text-white' : 'border-[rgba(55,53,47,0.25)]'}`}>
                  {active && <Check className="h-3 w-3" />}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Monto */}
      {company && (
        <fieldset>
          <legend className="text-[12px] font-semibold text-[#37352f]">Monto en Por Hora</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <AmountOption
              active={mode === 'rate'}
              title={`Tarifa de ${company.name}`}
              amount={rateTotal}
              onClick={() => setAmountMode('rate')}
            />
            <AmountOption
              active={mode === 'keep'}
              disabled={!canKeep}
              title="Lo que te pagaron"
              amount={earned}
              onClick={() => setAmountMode('keep')}
            />
          </div>
          {!canKeep && <p className="mt-2 text-[12px] text-[#787774]">{company.name} paga overtime: el monto lo calcula la compañía con sus horas.</p>}
        </fieldset>
      )}

      {/* Lo que ya te pagaron */}
      {company && showMarkPaid && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[rgba(55,53,47,0.12)] px-3.5 py-3">
          <input type="checkbox" checked={markPaid} onChange={e => setMarkPaid(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0f7b6c]" />
          <span className="text-[13px] text-[#37352f]">
            <span className="font-semibold">Anotar {formatCurrency(paidTotal)} como pagado por {company.name}</span>
            <span className="block text-[12px] text-[#787774]">
              {single ? 'Ya lo cobraste' : `${plural(paidJobs.length, 'trabajo cobrado', 'trabajos cobrados')}`}: así no sale en lo que te deben.
              {pendingCount > 0 && ` ${plural(pendingCount, 'trabajo por cobrar queda', 'trabajos por cobrar quedan')} sin pago anotado.`}
            </span>
          </span>
        </label>
      )}

      {error && <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => send('stop')}
          disabled={!company || busy !== null}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#37352f] py-3 text-[14px] font-semibold text-white hover:bg-[#2f2d28] disabled:opacity-60 touch-manipulation"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
          {single ? `Pasar a ${company?.name ?? 'Por Hora'}` : `Pasar ${jobs.length} a ${company?.name ?? 'Por Hora'}`}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-3 text-[14px] font-semibold text-[#787774] hover:bg-[rgba(55,53,47,0.06)]">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function AmountOption({ active, disabled = false, title, amount, onClick }: {
  readonly active: boolean
  readonly disabled?: boolean
  readonly title: string
  readonly amount: number
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 touch-manipulation ${active ? 'border-[#37352f] bg-[rgba(55,53,47,0.04)]' : 'border-[rgba(55,53,47,0.12)] hover:bg-[rgba(55,53,47,0.03)]'}`}
    >
      <span className="block truncate text-[12px] text-[#787774]">{title}</span>
      <span className="mt-0.5 block text-[17px] font-bold tabular-nums text-[#37352f]">{formatCurrency(amount)}</span>
    </button>
  )
}

function DuplicatesStep({ duplicates, total, busy, error, onChoose, onBack }: {
  readonly duplicates: MoveDuplicate[]
  readonly total: number
  readonly busy: DuplicateMode | null
  readonly error: string | null
  readonly onChoose: (mode: DuplicateMode) => void
  readonly onBack: () => void
}) {
  const allRepeated = duplicates.length >= total
  const others = total - duplicates.length
  const shown = duplicates.slice(0, 5)
  const button = 'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold disabled:opacity-60 touch-manipulation'

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
        <div className="text-[13px] text-amber-900">
          <p className="font-semibold">
            {allRepeated
              ? (total === 1 ? 'Este trabajo ya está en Por Hora' : 'Estos trabajos ya están en Por Hora')
              : `${plural(duplicates.length, 'trabajo ya está', 'trabajos ya están')} en Por Hora`}
          </p>
          <p className="mt-0.5">Tienen el mismo # de trabajo o casi las mismas horas que un registro que ya tienes. Pasarlos otra vez los contaría dos veces.</p>
        </div>
      </div>

      <ul className="divide-y divide-[rgba(55,53,47,0.08)] rounded-xl border border-[rgba(55,53,47,0.09)] px-4">
        {shown.map(d => (
          <li key={d.jobId} className="flex items-start gap-3 py-2.5">
            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#9b9a97]" />
            <div className="min-w-0 text-[13px]">
              <div className="truncate font-semibold text-[#37352f]">{d.jobTitle}</div>
              <div className="text-[12px] text-[#787774] tabular-nums">
                En {d.entry.companyName ?? 'Por Hora'}: {formatKeyShort(d.entry.date)} · {formatTime12(d.entry.startTime)}{d.entry.endTime ? ` → ${formatTime12(d.entry.endTime)}` : ''}
                {d.entry.jobNumber ? ` · #${d.entry.jobNumber.replace(/^#/, '')}` : ''}
              </div>
            </div>
          </li>
        ))}
        {duplicates.length > shown.length && (
          <li className="py-2.5 text-[12px] text-[#787774]">y {plural(duplicates.length - shown.length, 'más', 'más')}</li>
        )}
      </ul>

      {error && <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>}

      <div className="space-y-2">
        <button type="button" onClick={() => onChoose('remove')} disabled={busy !== null} className={`${button} bg-[#37352f] text-white hover:bg-[#2f2d28]`}>
          {busy === 'remove' && <Loader2 className="h-4 w-4 animate-spin" />}
          {allRepeated
            ? `Quitar${total === 1 ? 'lo' : 'los'} de Por Pago`
            : `Pasar ${plural(others, 'el otro', 'los otros')} y quitar los repetidos`}
        </button>
        {!allRepeated && (
          <button type="button" onClick={() => onChoose('skip')} disabled={busy !== null} className={`${button} border border-[rgba(55,53,47,0.16)] text-[#37352f] hover:bg-[rgba(55,53,47,0.05)]`}>
            {busy === 'skip' && <Loader2 className="h-4 w-4 animate-spin" />}
            Pasar solo {others === 1 ? 'el que no está' : `los ${others} que no están`}
          </button>
        )}
        <button type="button" onClick={() => onChoose('include')} disabled={busy !== null} className={`${button} text-[#787774] hover:bg-[rgba(55,53,47,0.06)]`}>
          {busy === 'include' && <Loader2 className="h-4 w-4 animate-spin" />}
          No son los mismos: pasar {total === 1 ? 'igual' : 'todos'}
        </button>
        <button type="button" onClick={onBack} disabled={busy !== null} className={`${button} text-[#787774] hover:bg-[rgba(55,53,47,0.06)]`}>
          Volver
        </button>
      </div>
    </div>
  )
}
