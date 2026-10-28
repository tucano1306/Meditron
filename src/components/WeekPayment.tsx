'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, BadgeCheck, Banknote, Check, ChevronRight, Hourglass, Pencil, Trash2, TrendingUp } from 'lucide-react'
import type { Company } from '@/lib/companies'
import type { PayPeriodSummary } from '@/lib/pay-periods'
import { formatKeyShort, hoursDecimal, money } from '@/lib/report-format'
import { getFloridaDateString } from '@/lib/utils'
import { weekPayStatus, type PaySummary, type WeekPayStatus } from '@/lib/week-payments'

// Pago de cada semana de pago: si la empresa ya pagó, cuánto, y la diferencia
// con lo que calcula la app.

const inputClass = 'mt-0.5 w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-3 py-2 text-[#37352f] focus:border-[#37352f] focus:outline-none'

async function send(url: string, method: string, body?: unknown): Promise<{ error: string | null; data?: unknown }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json()
    return json.success ? { error: null, data: json.data } : { error: json.error || 'No se pudo guardar' }
  } catch {
    return { error: 'Error de conexión' }
  }
}

function signedMoney(value: number): string {
  if (Math.abs(value) < 0.005) return money(0)
  return `${value > 0 ? '+' : '−'}${money(Math.abs(value))}`
}

function signedHours(value: number): string {
  if (Math.abs(value) < 0.005) return '0.00 h'
  return `${value > 0 ? '+' : '−'}${hoursDecimal(Math.abs(value) * 3600)} h`
}

// ── Etiqueta de estado ────────────────────────────────────────────────────────

export function PayStatusPill({ status }: { readonly status: WeekPayStatus }) {
  const base = 'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap'
  switch (status.state) {
    case 'paid':
      return <span className={`${base} border-emerald-300 bg-emerald-50 text-emerald-700`}><BadgeCheck className="h-2.5 w-2.5" />PAGADA</span>
    case 'short':
      return <span className={`${base} border-red-300 bg-red-50 text-red-700`}><AlertTriangle className="h-2.5 w-2.5" />TE DEBEN {money(status.owed)}</span>
    case 'over':
      return <span className={`${base} border-blue-300 bg-blue-50 text-blue-700`}><TrendingUp className="h-2.5 w-2.5" />+{money(status.difference)} DE MÁS</span>
    case 'owed':
      return <span className={`${base} border-amber-300 bg-amber-50 text-amber-800`}><Hourglass className="h-2.5 w-2.5" />POR COBRAR</span>
    default:
      return null
  }
}

// ── Formulario ────────────────────────────────────────────────────────────────

interface FormProps {
  readonly company: Company
  readonly period: PayPeriodSummary
  readonly onDone: (saved: boolean) => void
}

function PaymentForm({ company, period, onDone }: FormProps) {
  const today = getFloridaDateString()
  const payment = period.payment
  const [amount, setAmount] = useState(() => (payment?.amount ?? period.totalPay).toFixed(2))
  const [paidOn, setPaidOn] = useState(() => payment?.paidOn ?? today)
  const [hours, setHours] = useState(() => (payment?.hours == null ? '' : String(payment.hours)))
  const [netAmount, setNetAmount] = useState(() => (payment?.netAmount == null ? '' : String(payment.netAmount)))
  const [reference, setReference] = useState(payment?.reference ?? '')
  const [note, setNote] = useState(payment?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = Number.parseFloat(amount)
  const preview = Number.isFinite(parsed)
    ? weekPayStatus({ ...period, payment: { id: '', weekStart: period.start, amount: parsed, netAmount: null, hours: hours ? Number.parseFloat(hours) : null, paidOn, reference: null, note: null } }, today)
    : null

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const result = await send(`/api/companies/${company.id}/payments`, 'PUT', {
      weekStart: period.start,
      amount,
      paidOn,
      hours: hours.trim() || null,
      netAmount: netAmount.trim() || null,
      reference: reference.trim() || null,
      note: note.trim() || null,
    })
    setSaving(false)
    if (result.error) setError(result.error)
    else onDone(true)
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#37352f] bg-white p-3 animate-fade-in">
      <div className="text-[13px] font-semibold text-[#37352f]">{payment ? 'Corregir el pago' : 'Registrar el pago'} de {company.name}</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-[#787774]">
          Te pagaron (bruto)
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 mt-[1px] -translate-y-1/2 text-[#787774]">$</span>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={`${inputClass} pl-6`} style={{ fontSize: '16px' }} />
          </div>
        </label>
        <label className="block text-[11px] text-[#787774]">
          Fecha del pago
          <input type="date" value={paidOn} max={today} onChange={e => setPaidOn(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
        </label>
      </div>
      <p className="-mt-1 text-[11px] text-[#9b9a97]">El total ganado del talonario, antes de impuestos. La app calcula {money(period.totalPay)}.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-[#787774]">
          Horas pagadas (opcional)
          <input type="number" inputMode="decimal" step="0.01" min="0" value={hours} onChange={e => setHours(e.target.value)} placeholder={hoursDecimal(period.totalSeconds)} className={inputClass} style={{ fontSize: '16px' }} />
        </label>
        <label className="block text-[11px] text-[#787774]">
          Depositado (neto, opcional)
          <input type="number" inputMode="decimal" step="0.01" min="0" value={netAmount} onChange={e => setNetAmount(e.target.value)} placeholder="Después de impuestos" className={inputClass} style={{ fontSize: '16px' }} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-[#787774]">
          # de cheque o depósito (opcional)
          <input type="text" value={reference} maxLength={60} onChange={e => setReference(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
        </label>
        <label className="block text-[11px] text-[#787774]">
          Nota (opcional)
          <input type="text" value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="Ej: faltó el lunes" className={inputClass} style={{ fontSize: '16px' }} />
        </label>
      </div>

      {preview && preview.state !== 'empty' && (
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] ${preview.state === 'short' ? 'bg-red-50 text-red-800' : preview.state === 'over' ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800'}`}>
          <span>Diferencia con la app</span>
          <span className="font-bold tabular-nums">{signedMoney(preview.difference)}</span>
        </div>
      )}
      {error && <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onDone(false)} className="rounded-xl bg-[rgba(55,53,47,0.06)] py-2.5 text-[14px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.12)] touch-manipulation">
          Cancelar
        </button>
        <button type="button" onClick={handleSave} disabled={saving || !Number.isFinite(parsed) || !paidOn} className="rounded-xl bg-[#37352f] py-2.5 text-[14px] font-semibold text-white disabled:opacity-50 touch-manipulation">
          {saving ? 'Guardando...' : 'Guardar pago'}
        </button>
      </div>
    </div>
  )
}

// ── Panel de pago de una semana ───────────────────────────────────────────────

interface PanelProps {
  readonly company: Company
  readonly period: PayPeriodSummary
  /** Se llama después de registrar, corregir o quitar el pago */
  readonly onChanged: () => void
}

const TONES = {
  paid: { box: 'border-emerald-200 bg-emerald-50/60', title: 'text-emerald-800', diff: 'text-emerald-700' },
  short: { box: 'border-red-200 bg-red-50/60', title: 'text-red-800', diff: 'text-red-700' },
  over: { box: 'border-blue-200 bg-blue-50/60', title: 'text-blue-800', diff: 'text-blue-700' },
}

export function WeekPaymentPanel({ company, period, onChanged }: PanelProps) {
  const today = getFloridaDateString()
  const status = weekPayStatus(period, today)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status.state === 'empty') return null

  const done = (saved: boolean) => {
    setEditing(false)
    if (saved) onChanged()
  }

  const payExact = async () => {
    setBusy(true)
    setError(null)
    const result = await send(`/api/companies/${company.id}/payments`, 'PUT', {
      weekStart: period.start,
      amount: period.totalPay.toFixed(2),
      paidOn: today,
    })
    setBusy(false)
    if (result.error) setError(result.error)
    else onChanged()
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    const result = await send(`/api/companies/${company.id}/payments?weekStart=${period.start}`, 'DELETE')
    setBusy(false)
    setConfirmDelete(false)
    if (result.error) setError(result.error)
    else onChanged()
  }

  if (editing) return <PaymentForm company={company} period={period} onDone={done} />

  const errorBox = error && <div className="mt-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>

  // Semana en curso: todavía no se cobra (pero se puede anotar un adelanto)
  if (status.state === 'in_progress') {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-[rgba(55,53,47,0.2)] px-3 py-2.5 text-[12px] text-[#787774]">
        <span>La semana termina el {formatKeyShort(period.end)}; después podrás marcarla como pagada.</span>
        <button type="button" onClick={() => setEditing(true)} className="flex-shrink-0 font-semibold text-[#37352f] underline underline-offset-2">Ya me pagaron</button>
      </div>
    )
  }

  // Terminada y sin pago registrado
  if (status.state === 'owed') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <Banknote className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-amber-900">¿Ya te pagó {company.name} esta semana?</div>
            <div className="text-[12px] text-amber-800">Según la app te corresponden <span className="font-bold">{money(status.expected)}</span>.</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={payExact} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#37352f] px-2 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50 touch-manipulation">
            <Check className="h-4 w-4 flex-shrink-0" />
            {busy ? 'Guardando...' : `Sí, ${money(status.expected)}`}
          </button>
          <button type="button" onClick={() => setEditing(true)} disabled={busy} className="rounded-xl border border-amber-300 bg-white px-2 py-2.5 text-[13px] font-semibold text-[#37352f] disabled:opacity-50 touch-manipulation">
            Pagó otro monto
          </button>
        </div>
        {errorBox}
      </div>
    )
  }

  // Pagada: comparación con la app
  const payment = period.payment!
  const tone = TONES[status.state as 'paid' | 'short' | 'over']
  let title = 'Pagada · coincide con la app'
  let message: string | null = null
  if (status.state === 'short') {
    title = `Pagada de menos · te deben ${money(status.owed)}`
    message = `${company.name} pagó ${money(status.owed)} menos de lo que registraste. Revisa el talonario y reclama la diferencia.`
  } else if (status.state === 'over') {
    title = `Pagada de más · ${money(status.difference)}`
    message = `${company.name} pagó ${money(status.difference)} más de lo que calcula la app. Revisa si falta registrar algún turno.`
  } else if (Math.abs(status.difference) >= 0.01) {
    message = `Diferencia de ${signedMoney(status.difference)} por redondeo del talonario.`
  }

  return (
    <div className={`rounded-xl border p-3 ${tone.box}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`flex items-center gap-1.5 text-[14px] font-semibold ${tone.title}`}>
            {status.state === 'paid' ? <BadgeCheck className="h-4 w-4 flex-shrink-0" /> : <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
            {title}
          </div>
          <div className="text-[12px] text-[#787774]">
            Pagada el {formatKeyShort(payment.paidOn)}{payment.reference ? ` · # ${payment.reference}` : ''}
          </div>
        </div>
        <button type="button" onClick={() => setEditing(true)} aria-label="Corregir el pago" className="flex-shrink-0 rounded-lg p-1.5 text-[#787774] hover:bg-white/70 hover:text-[#37352f]">
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-[rgba(55,53,47,0.1)] rounded-lg bg-white/80 text-center">
        <div className="px-1.5 py-2">
          <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Según la app</div>
          <div className="text-[14px] font-bold tabular-nums text-[#37352f]">{money(status.expected)}</div>
        </div>
        <div className="px-1.5 py-2">
          <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Pagó</div>
          <div className="text-[14px] font-bold tabular-nums text-[#37352f]">{money(status.paid)}</div>
        </div>
        <div className="px-1.5 py-2">
          <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Diferencia</div>
          <div className={`text-[14px] font-bold tabular-nums ${tone.diff}`}>{signedMoney(status.difference)}</div>
        </div>
      </div>

      {status.hoursDifference !== null && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-white/60 px-3 py-1.5 text-[12px] text-[#37352f]">
          <span>Horas: app {hoursDecimal(period.totalSeconds)} · talonario {hoursDecimal((payment.hours ?? 0) * 3600)}</span>
          <span className={`font-semibold tabular-nums ${Math.abs(status.hoursDifference) < 0.01 ? 'text-emerald-700' : tone.diff}`}>{signedHours(status.hoursDifference)}</span>
        </div>
      )}
      {message && <p className="mt-2 text-[12px] text-[#37352f]">{message}</p>}
      {payment.netAmount !== null && <p className="mt-1 text-[12px] text-[#787774]">Depositado: {money(payment.netAmount)} (después de impuestos)</p>}
      {payment.note && <p className="mt-1 text-[12px] text-[#787774]">Nota: {payment.note}</p>}

      <div className="mt-2 flex justify-end">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-[#787774]">¿Quitar el pago? Vuelve a «por cobrar»</span>
            <button type="button" onClick={remove} disabled={busy} className="rounded-lg bg-[#dc2626] px-2.5 py-1 font-semibold text-white disabled:opacity-50">Quitar</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-2 py-1 font-semibold text-[#787774] hover:bg-white/70">No</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-[#787774] hover:bg-white/70 hover:text-[#dc2626]">
            <Trash2 className="h-3.5 w-3.5" />
            Quitar pago
          </button>
        )}
      </div>
      {errorBox}
    </div>
  )
}

// ── Marcar varias semanas viejas como pagadas ─────────────────────────────────

interface BulkProps {
  readonly company: Company
  /** Semanas terminadas sin pago, de la más reciente a la más antigua */
  readonly owed: PayPeriodSummary[]
  readonly onChanged: () => void
}

export function MarkOlderPaid({ company, owed, onChanged }: BulkProps) {
  const [open, setOpen] = useState(false)
  const [through, setThrough] = useState(() => owed[0]?.start ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (owed.length < 2) return null

  const chosen = owed.filter(p => p.start <= through)
  const total = chosen.reduce((sum, p) => sum + p.totalPay, 0)

  const apply = async () => {
    setBusy(true)
    setError(null)
    const result = await send(`/api/companies/${company.id}/payments`, 'POST', { through })
    setBusy(false)
    if (result.error) setError(result.error)
    else { setOpen(false); onChanged() }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-[rgba(55,53,47,0.12)] bg-white px-3 py-2.5 text-left text-[12px] text-[#787774] hover:bg-[rgba(55,53,47,0.03)] touch-manipulation">
        <span>¿Ya te pagaron las semanas anteriores? <span className="font-semibold text-[#37352f]">Márcalas de una vez</span></span>
        <ChevronRight className="h-4 w-4 flex-shrink-0" />
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#37352f] bg-white p-3 animate-fade-in">
      <div className="text-[13px] font-semibold text-[#37352f]">Marcar semanas como pagadas</div>
      <label className="block text-[11px] text-[#787774]">
        Todas las semanas por cobrar hasta la del
        <select value={through} onChange={e => setThrough(e.target.value)} className={inputClass} style={{ fontSize: '16px' }}>
          {owed.map(p => (
            <option key={p.start} value={p.start}>{formatKeyShort(p.start)} → {formatKeyShort(p.end)} · {money(p.totalPay)}</option>
          ))}
        </select>
      </label>
      <p className="text-[12px] text-[#787774]">
        Se marcan {chosen.length} {chosen.length === 1 ? 'semana' : 'semanas'} como pagadas por lo que calcula la app ({money(total)}). Si alguna tuvo otro monto, corrígela después.
      </p>
      {error && <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-[rgba(55,53,47,0.06)] py-2.5 text-[14px] font-semibold text-[#37352f] touch-manipulation">Cancelar</button>
        <button type="button" onClick={apply} disabled={busy || chosen.length === 0} className="rounded-xl bg-[#37352f] py-2.5 text-[14px] font-semibold text-white disabled:opacity-50 touch-manipulation">
          {busy ? 'Marcando...' : `Marcar ${chosen.length}`}
        </button>
      </div>
    </div>
  )
}

// ── Aviso en el panel: lo que falta cobrar ────────────────────────────────────

interface BannerProps {
  readonly company: Company
  readonly refreshTrigger?: number
  readonly onReview: () => void
}

export function PaymentsBanner({ company, refreshTrigger = 0, onReview }: BannerProps) {
  const [data, setData] = useState<PaySummary | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/companies/${company.id}/payments`)
      .then(res => res.json())
      .then(json => { if (!cancelled && json.success) setData(json.data) })
      .catch(() => { /* el aviso es opcional */ })
    return () => { cancelled = true }
  }, [company.id, refreshTrigger])

  if (!data || (data.owedWeeks === 0 && data.shortWeeks === 0)) return null

  const parts: string[] = []
  if (data.owedWeeks > 0) parts.push(`${data.owedWeeks} ${data.owedWeeks === 1 ? 'semana sin cobrar' : 'semanas sin cobrar'}`)
  if (data.shortWeeks > 0) parts.push(`${data.shortWeeks} ${data.shortWeeks === 1 ? 'pagada de menos' : 'pagadas de menos'}`)

  return (
    <button
      type="button"
      onClick={onReview}
      className="relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-left shadow-sm transition-colors hover:bg-amber-50 animate-card-in touch-manipulation"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: company.color }} />
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
        <Banknote className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-amber-900">{company.name} te debe {money(data.owedTotal)}</span>
        <span className="block text-[12px] text-amber-800">{parts.join(' · ')}</span>
      </span>
      <span className="flex flex-shrink-0 items-center gap-0.5 text-[13px] font-semibold text-amber-900">
        Revisar
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  )
}
