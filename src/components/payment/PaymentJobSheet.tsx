'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft, Bus, CalendarDays, Check, Clock, Copy, Hash, Loader2, NotebookPen, Pencil, Trash2, User, Wallet, X,
} from 'lucide-react'
import { formatCurrency, floridaShiftToUTC, getFloridaDateComponents, getFloridaDateString } from '@/lib/utils'
import { formatKeyLong, formatTime12 } from '@/lib/report-format'
import { formatHM } from '@/lib/display'
import {
  jobEarned, jobTitle, methodLabel, PAYMENT_METHODS, ratePerHour, vehicleLabel, VEHICLES,
  type PaymentJob, type PaymentMethod, type PaymentStatus,
} from '@/lib/payment-jobs'
import { METHOD_ICONS, PAY_ACCENT, PendingPill } from './shared'
import { floridaDateKey } from './data'

// Hoja de un trabajo por pago: ver su detalle, editarlo, duplicarlo o agregar
// uno nuevo. En el teléfono sube desde abajo; en pantallas grandes es un panel.

export type SheetMode =
  | { kind: 'view'; job: PaymentJob }
  | { kind: 'edit'; job: PaymentJob }
  | { kind: 'create'; prefill?: Partial<JobDraft> }

interface PaymentJobSheetProps {
  readonly mode: SheetMode
  readonly onClose: () => void
  /** Se guardó, borró o cambió de estado un trabajo */
  readonly onChanged: (message: string) => void
}

export interface JobDraft {
  date: string
  start: string
  end: string
  amount: string
  tip: string
  client: string
  jobNumber: string
  vehicle: string
  paymentMethod: PaymentMethod | ''
  paymentStatus: PaymentStatus
  notes: string
}

const LAST_METHOD_KEY = 'meditron_last_payment_method'
const inputClass = 'mt-1 w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-3 py-2.5 text-[#37352f] placeholder:text-[#b4b4b0] focus:border-[#37352f] focus:outline-none'
const labelClass = 'block text-[12px] font-semibold text-[#37352f]'

function hhmm(iso: string | Date): string {
  const { hour, minute } = getFloridaDateComponents(new Date(iso))
  return `${String(hour % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function draftFromJob(job: PaymentJob): JobDraft {
  return {
    date: job.date,
    start: hhmm(job.startTime),
    end: hhmm(job.endTime),
    amount: String(job.amount),
    tip: job.tip ? String(job.tip) : '',
    client: job.client ?? '',
    jobNumber: job.jobNumber ?? '',
    vehicle: job.vehicle ?? '',
    paymentMethod: job.paymentMethod ?? '',
    paymentStatus: job.paymentStatus,
    notes: job.notes ?? '',
  }
}

function emptyDraft(): JobDraft {
  // Por defecto: un trabajo de una hora que acaba de terminar (redondeado a 5 min)
  const end = new Date(Math.floor(Date.now() / (5 * 60000)) * 5 * 60000)
  const start = new Date(end.getTime() - 3600 * 1000)
  let lastMethod: PaymentMethod | '' = ''
  try {
    lastMethod = (localStorage.getItem(LAST_METHOD_KEY) as PaymentMethod | null) ?? ''
  } catch { /* sin almacenamiento disponible */ }
  return {
    date: getFloridaDateString(), start: hhmm(start), end: hhmm(end), amount: '', tip: '', client: '',
    jobNumber: '', vehicle: '', paymentMethod: lastMethod, paymentStatus: 'paid', notes: '',
  }
}

function toNumber(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function useClientSuggestions(): string[] {
  const [clients, setClients] = useState<string[]>([])
  useEffect(() => {
    fetch('/api/payment/clients')
      .then(res => res.json())
      .then(json => { if (json.success) setClients(json.data) })
      .catch(() => undefined)
  }, [])
  return clients
}

// ── Detalle ───────────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { readonly icon: React.ReactNode; readonly label: string; readonly value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-[#9b9a97]">{icon}</span>
      <span className="w-28 flex-shrink-0 text-[13px] text-[#787774]">{label}</span>
      <span className="min-w-0 flex-1 text-[14px] text-[#37352f] break-words">{value}</span>
    </div>
  )
}

interface JobDetailProps {
  readonly job: PaymentJob
  readonly busy: string | null
  readonly onEdit: () => void
  readonly onDuplicate: () => void
  readonly onToggleStatus: () => void
  readonly onDelete: () => void
}

function JobDetail({ job, busy, onEdit, onDuplicate, onToggleStatus, onDelete }: JobDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const earned = jobEarned(job)
  const rate = ratePerHour(earned, job.duration)
  const pending = job.paymentStatus === 'pending'

  return (
    <div className="space-y-5">
      {/* Total */}
      <div className="rounded-xl bg-[rgba(55,53,47,0.04)] p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#787774]">Total ganado</div>
            <div className="mt-1 text-[32px] font-bold leading-none tabular-nums text-[#0f7b6c]">{formatCurrency(earned)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#787774]">Por hora</div>
            <div className="mt-1 text-[20px] font-bold leading-none tabular-nums text-[#37352f]">{formatCurrency(rate)}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#787774] tabular-nums">
          <span>Pago {formatCurrency(job.amount)}</span>
          {job.tip > 0 && <span>+ Propina {formatCurrency(job.tip)}</span>}
          <span>· {formatHM(job.duration)}</span>
        </div>
      </div>

      {/* Cobro */}
      <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${pending ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
        <div className="min-w-0">
          {pending ? <PendingPill /> : (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-800">
              <Check className="h-4 w-4" /> Cobrado
            </span>
          )}
          <div className="mt-1 text-[12px] text-[#787774]">
            {pending ? 'Todavía no te pagan este trabajo.' : job.paidAt ? `El ${formatKeyLong(floridaDateKey(job.paidAt)).toLowerCase()}` : 'Pagado'}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleStatus}
          disabled={busy !== null}
          className={`flex-shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60 touch-manipulation ${pending ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-[#787774] hover:bg-white'}`}
        >
          {busy === 'status' ? <Loader2 className="h-4 w-4 animate-spin" /> : pending ? 'Marcar cobrado' : 'Marcar por cobrar'}
        </button>
      </div>

      {/* Datos */}
      <div className="divide-y divide-[rgba(55,53,47,0.08)] rounded-xl border border-[rgba(55,53,47,0.09)] px-4">
        <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Fecha" value={formatKeyLong(job.date)} />
        <DetailRow icon={<Clock className="h-4 w-4" />} label="Horario" value={`${formatTime12(job.startTime)} → ${formatTime12(job.endTime)}`} />
        {job.client && <DetailRow icon={<User className="h-4 w-4" />} label="Cliente" value={job.client} />}
        {job.jobNumber && <DetailRow icon={<Hash className="h-4 w-4" />} label="Trabajo #" value={<span className="font-mono font-semibold">{job.jobNumber}</span>} />}
        {job.vehicle && <DetailRow icon={<Bus className="h-4 w-4" />} label="Vehículo" value={vehicleLabel(job.vehicle)} />}
        {job.paymentMethod && (
          <DetailRow
            icon={<Wallet className="h-4 w-4" />}
            label="Método"
            value={<span className="inline-flex items-center gap-1.5">{METHOD_ICONS[job.paymentMethod]}{methodLabel(job.paymentMethod)}</span>}
          />
        )}
        {job.notes && <DetailRow icon={<NotebookPen className="h-4 w-4" />} label="Notas" value={<span className="whitespace-pre-wrap">{job.notes}</span>} />}
      </div>

      {/* Acciones */}
      {confirmDelete ? (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-[13px] text-red-800">¿Eliminar este trabajo de {formatCurrency(earned)}? No se puede deshacer.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onDelete} disabled={busy !== null} className="flex-1 rounded-lg bg-red-600 py-2.5 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {busy === 'delete' ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-[#787774] hover:bg-white">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={onEdit} className="flex flex-col items-center gap-1 rounded-xl bg-[#37352f] py-3 text-[13px] font-semibold text-white hover:bg-[#2f2d28] touch-manipulation">
            <Pencil className="h-4 w-4" /> Editar
          </button>
          <button type="button" onClick={onDuplicate} className="flex flex-col items-center gap-1 rounded-xl border border-[rgba(55,53,47,0.16)] py-3 text-[13px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.05)] touch-manipulation">
            <Copy className="h-4 w-4" /> Duplicar
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} className="flex flex-col items-center gap-1 rounded-xl border border-[rgba(55,53,47,0.16)] py-3 text-[13px] font-semibold text-red-600 hover:bg-red-50 touch-manipulation">
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Formulario ────────────────────────────────────────────────────────────────

interface JobFormProps {
  readonly initial: JobDraft
  readonly busy: boolean
  readonly error: string | null
  readonly submitLabel: string
  readonly onSubmit: (draft: JobDraft) => void
}

function JobForm({ initial, busy, error, submitLabel, onSubmit }: JobFormProps) {
  const [draft, setDraft] = useState(initial)
  const clients = useClientSuggestions()
  const set = (patch: Partial<JobDraft>) => setDraft(d => ({ ...d, ...patch }))

  const times = floridaShiftToUTC(draft.date, draft.start, draft.end)
  const seconds = times ? Math.round((times.end.getTime() - times.start.getTime()) / 1000) : 0
  const amount = toNumber(draft.amount)
  const tip = toNumber(draft.tip)
  const earned = amount + tip
  const crossesMidnight = Boolean(times) && draft.end <= draft.start
  const canSave = Boolean(times) && seconds > 0 && amount > 0 && !busy

  return (
    <form
      className="space-y-5"
      onSubmit={e => { e.preventDefault(); if (canSave) onSubmit(draft) }}
    >
      {/* Cuándo */}
      <section className="space-y-3">
        <label className={labelClass}>
          Fecha
          <input type="date" value={draft.date} max={getFloridaDateString()} onChange={e => set({ date: e.target.value })} className={inputClass} style={{ fontSize: '16px' }} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Empezó
            <input type="time" value={draft.start} onChange={e => set({ start: e.target.value })} className={inputClass} style={{ fontSize: '16px' }} required />
          </label>
          <label className={labelClass}>
            Terminó
            <input type="time" value={draft.end} onChange={e => set({ end: e.target.value })} className={inputClass} style={{ fontSize: '16px' }} required />
          </label>
        </div>
        {crossesMidnight && <p className="text-[12px] text-[#787774]">Terminó al día siguiente (cruzó la medianoche).</p>}
      </section>

      {/* Cuánto */}
      <section className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Pago
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-[#9b9a97]">$</span>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={draft.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" className={`${inputClass} pl-7 text-[18px] font-semibold tabular-nums`} style={{ fontSize: '18px' }} required autoFocus={!initial.amount} />
          </div>
        </label>
        <label className={labelClass}>
          Propina <span className="font-normal text-[#9b9a97]">(opcional)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-[#9b9a97]">$</span>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={draft.tip} onChange={e => set({ tip: e.target.value })} placeholder="0.00" className={`${inputClass} pl-7 tabular-nums`} style={{ fontSize: '16px' }} />
          </div>
        </label>
      </section>

      {/* Vista previa en vivo */}
      <div className="grid grid-cols-3 divide-x divide-[rgba(55,53,47,0.08)] rounded-xl bg-[rgba(55,53,47,0.04)] py-3 text-center">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9a97]">Total</div>
          <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#0f7b6c]">{formatCurrency(earned)}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9a97]">Tiempo</div>
          <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#37352f]">{times && seconds > 0 ? formatHM(seconds) : '—'}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9a97]">Por hora</div>
          <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#37352f]">{seconds > 0 && earned > 0 ? formatCurrency(ratePerHour(earned, seconds)) : '—'}</div>
        </div>
      </div>

      {/* Cobro */}
      <section className="space-y-2">
        <div className={labelClass}>¿Ya te pagaron?</div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[rgba(55,53,47,0.06)] p-1" role="radiogroup">
          {([['paid', 'Sí, ya cobré'], ['pending', 'No, por cobrar']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={draft.paymentStatus === value}
              onClick={() => set({ paymentStatus: value })}
              className={`rounded-lg py-2.5 text-[13px] font-semibold transition-all touch-manipulation ${draft.paymentStatus === value ? (value === 'paid' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white text-amber-700 shadow-sm') : 'text-[#787774]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PAYMENT_METHODS.map(m => {
            const active = draft.paymentMethod === m.value
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => set({ paymentMethod: active ? '' : m.value })}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors touch-manipulation ${active ? 'bg-[#37352f] text-white' : 'bg-[rgba(55,53,47,0.06)] text-[#37352f] hover:bg-[rgba(55,53,47,0.12)]'}`}
              >
                {METHOD_ICONS[m.value]}
                {m.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Detalles */}
      <section className="space-y-3">
        <label className={labelClass}>
          Cliente o descripción <span className="font-normal text-[#9b9a97]">(opcional)</span>
          <input type="text" list="payment-clients" value={draft.client} maxLength={80} onChange={e => set({ client: e.target.value })} placeholder="Ej: Hotel Marriott, boda Pérez…" className={inputClass} style={{ fontSize: '16px' }} />
          <datalist id="payment-clients">
            {clients.map(c => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className={labelClass}>
          Trabajo # <span className="font-normal text-[#9b9a97]">(opcional)</span>
          <input type="text" value={draft.jobNumber} maxLength={30} onChange={e => set({ jobNumber: e.target.value })} placeholder="Ej: 237754" className={`${inputClass} font-mono`} style={{ fontSize: '16px' }} />
        </label>
        <div>
          <div className={labelClass}>Vehículo <span className="font-normal text-[#9b9a97]">(opcional)</span></div>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {VEHICLES.map(v => (
              <button
                key={v.value}
                type="button"
                onClick={() => set({ vehicle: draft.vehicle === v.value ? '' : v.value })}
                className={`rounded-lg py-2 text-[13px] font-medium transition-colors touch-manipulation ${draft.vehicle === v.value ? 'bg-[#37352f] text-white' : 'border border-[rgba(55,53,47,0.16)] text-[#37352f] hover:bg-[rgba(55,53,47,0.05)]'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <label className={labelClass}>
          Notas <span className="font-normal text-[#9b9a97]">(opcional)</span>
          <textarea value={draft.notes} maxLength={500} rows={2} onChange={e => set({ notes: e.target.value })} placeholder="Ej: pagan la propina aparte" className={`${inputClass} resize-none`} style={{ fontSize: '16px' }} />
        </label>
      </section>

      {error && <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>}

      <button
        type="submit"
        disabled={!canSave}
        className="sticky bottom-0 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold text-white shadow-lg transition-opacity disabled:opacity-50 touch-manipulation active:scale-[0.99]"
        style={{ backgroundColor: PAY_ACCENT }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {busy ? 'Guardando…' : submitLabel}
      </button>
    </form>
  )
}

function draftToBody(draft: JobDraft) {
  return {
    date: draft.date,
    start: draft.start,
    end: draft.end,
    amount: toNumber(draft.amount),
    tip: draft.tip.trim() ? toNumber(draft.tip) : null,
    client: draft.client,
    jobNumber: draft.jobNumber,
    vehicle: draft.vehicle || null,
    paymentMethod: draft.paymentMethod || null,
    paymentStatus: draft.paymentStatus,
    notes: draft.notes,
  }
}

// ── Hoja ──────────────────────────────────────────────────────────────────────

export function PaymentJobSheet({ mode: initialMode, onClose, onChanged }: PaymentJobSheetProps) {
  const [mode, setMode] = useState<SheetMode>(initialMode)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Se abre solo al tocar algo (nunca en el servidor), así que ya hay document
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const request = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'No se pudo guardar')
    return json.data as PaymentJob | undefined
  }

  const save = async (draft: JobDraft) => {
    setBusy('save')
    setError(null)
    try {
      if (draft.paymentMethod) {
        try { localStorage.setItem(LAST_METHOD_KEY, draft.paymentMethod) } catch { /* sin almacenamiento */ }
      }
      if (mode.kind === 'edit') {
        const job = await request(`/api/payment/jobs/${mode.job.id}`, 'PATCH', draftToBody(draft))
        onChanged('Trabajo actualizado')
        if (job) setMode({ kind: 'view', job })
      } else {
        await request('/api/payment/jobs', 'POST', draftToBody(draft))
        onChanged(draft.paymentStatus === 'pending' ? 'Trabajo agregado como por cobrar' : 'Trabajo agregado')
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setBusy(null)
    }
  }

  const toggleStatus = async (job: PaymentJob) => {
    setBusy('status')
    try {
      const next: PaymentStatus = job.paymentStatus === 'pending' ? 'paid' : 'pending'
      const updated = await request(`/api/payment/jobs/${job.id}`, 'PATCH', { paymentStatus: next })
      onChanged(next === 'paid' ? 'Marcado como cobrado' : 'Marcado como por cobrar')
      if (updated) setMode({ kind: 'view', job: updated })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (job: PaymentJob) => {
    setBusy('delete')
    try {
      await request(`/api/payment/jobs/${job.id}`, 'DELETE')
      onChanged('Trabajo eliminado')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión')
      setBusy(null)
    }
  }

  let title = 'Agregar trabajo'
  let subtitle = 'Un trabajo que hiciste sin el cronómetro'
  if (mode.kind === 'view') {
    title = jobTitle(mode.job)
    subtitle = `${formatKeyLong(mode.job.date)} · ${formatTime12(mode.job.startTime)} → ${formatTime12(mode.job.endTime)}`
  } else if (mode.kind === 'edit') {
    title = 'Editar trabajo'
    subtitle = jobTitle(mode.job)
  } else if (mode.prefill) {
    title = 'Duplicar trabajo'
    subtitle = 'Revisa la fecha y las horas'
  }

  return createPortal(
    <dialog open aria-label={title} className="fixed inset-0 z-[9999] m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 sm:items-center">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/50 animate-fade-in-backdrop" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up-modal sm:max-h-[90dvh] sm:rounded-2xl">
        <div className="flex justify-center pt-2 sm:hidden"><span className="h-1 w-10 rounded-full bg-[rgba(55,53,47,0.2)]" /></div>
        <div className="flex items-start gap-2 border-b border-[rgba(55,53,47,0.09)] px-5 pb-3 pt-3 sm:pt-5">
          {mode.kind === 'edit' && (
            <button type="button" onClick={() => setMode({ kind: 'view', job: mode.job })} aria-label="Volver" className="-ml-2 rounded-lg p-1.5 text-[#787774] hover:bg-[rgba(55,53,47,0.08)]">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-bold text-[#37352f]">{title}</h2>
            <p className="truncate text-[12px] text-[#787774]">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-xl bg-[rgba(55,53,47,0.06)] p-2 text-[#787774] hover:bg-[rgba(55,53,47,0.12)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 pb-safe">
          {mode.kind === 'view' && (
            <>
              <JobDetail
                key={mode.job.id + mode.job.paymentStatus}
                job={mode.job}
                busy={busy}
                onEdit={() => { setError(null); setMode({ kind: 'edit', job: mode.job }) }}
                onDuplicate={() => {
                  const draft = draftFromJob(mode.job)
                  setError(null)
                  setMode({ kind: 'create', prefill: { ...draft, date: getFloridaDateString(), paymentStatus: 'paid' } })
                }}
                onToggleStatus={() => toggleStatus(mode.job)}
                onDelete={() => remove(mode.job)}
              />
              {error && <div className="mt-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>}
            </>
          )}
          {mode.kind === 'edit' && (
            <JobForm key={`edit-${mode.job.id}`} initial={draftFromJob(mode.job)} busy={busy === 'save'} error={error} submitLabel="Guardar cambios" onSubmit={save} />
          )}
          {mode.kind === 'create' && (
            <JobForm key={`create-${JSON.stringify(mode.prefill ?? {})}`} initial={{ ...emptyDraft(), ...mode.prefill }} busy={busy === 'save'} error={error} submitLabel="Guardar trabajo" onSubmit={save} />
          )}
        </div>
      </div>
    </dialog>,
    document.body
  )
}
