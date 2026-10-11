'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Bus, Check, Hash, History, Loader2, Pencil, Play, Smartphone, Square, Undo2, User, X } from 'lucide-react'
import { formatDuration, formatCurrency } from '@/lib/utils'
import { formatTime12 } from '@/lib/report-format'
import { formatHM } from '@/lib/display'
import { PAYMENT_METHODS, ratePerHour, VEHICLES, type PaymentJob, type PaymentMethod, type PaymentStatus } from '@/lib/payment-jobs'
import { StartTimePicker } from './StartTimePicker'
import { METHOD_ICONS, PAY_ACCENT } from './payment/shared'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import { useWakeLock } from '@/hooks/useWakeLock'

// Cronómetro del modo "Por pago": se inicia al empezar el trabajo y al
// terminarlo se anota cuánto pagaron (y la propina, el cliente, cómo y si ya
// se cobró). El tiempo y el pago dan lo que se ganó por hora.

const LAST_METHOD_KEY = 'meditron_last_payment_method'

interface PaymentTimerProps {
  /** Se guardó el trabajo al terminarlo */
  readonly onComplete?: (job: PaymentJob | null) => void
}

interface FinishDraft {
  amount: string
  tip: string
  client: string
  notes: string
  paymentMethod: PaymentMethod | ''
  paymentStatus: PaymentStatus
}

function toNumber(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Dato del trabajo en curso que se edita en el lugar (cliente, número de trabajo) */
function InlineField({ icon, label, value, placeholder, mono = false, onSave }: {
  readonly icon: React.ReactNode
  readonly label: string
  readonly value: string
  readonly placeholder: string
  readonly mono?: boolean
  readonly onSave: (value: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    if (await onSave(draft.trim())) setEditing(false)
    setSaving(false)
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-[8px] border border-[rgba(55,53,47,0.09)] px-3 py-2.5">
      <span className="flex flex-shrink-0 items-center gap-2 text-[13px] text-[#787774]">{icon}{label}</span>
      {editing ? (
        <form className="flex min-w-0 items-center gap-1.5" onSubmit={e => { e.preventDefault(); save() }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={placeholder}
            className={`w-36 min-w-0 rounded-[4px] border border-[rgba(55,53,47,0.16)] px-2 py-1 text-[#37352f] focus:border-[#37352f] focus:outline-none sm:w-48 ${mono ? 'font-mono' : ''}`}
            style={{ fontSize: '16px' }}
            autoFocus
          />
          <button type="submit" disabled={saving} className="rounded-[4px] bg-[#37352f] px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">
            {saving ? '…' : 'OK'}
          </button>
          <button type="button" onClick={() => { setEditing(false); setDraft(value) }} aria-label="Cancelar" className="rounded-[4px] p-1 text-[#787774] hover:bg-[rgba(55,53,47,0.08)]">
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => { setDraft(value); setEditing(true) }} className="flex min-w-0 items-center gap-1.5 rounded-[4px] px-2 py-1 text-[13px] hover:bg-[rgba(55,53,47,0.08)]">
          <span className={`truncate ${value ? `font-semibold text-[#37352f] ${mono ? 'font-mono' : ''}` : 'text-[#9b9a97]'}`}>{value || placeholder}</span>
          <Pencil className="h-3 w-3 flex-shrink-0 text-[#9b9a97]" />
        </button>
      )}
    </div>
  )
}

interface FinishSheetProps {
  readonly elapsed: number
  readonly initialClient: string
  readonly busy: boolean
  readonly error: string | null
  readonly onConfirm: (draft: FinishDraft) => void
  readonly onCancel: () => void
}

// Al terminar: cuánto te pagaron y cómo
function FinishSheet({ elapsed, initialClient, busy, error, onConfirm, onCancel }: FinishSheetProps) {
  const [draft, setDraft] = useState<FinishDraft>(() => {
    let lastMethod: PaymentMethod | '' = ''
    try {
      lastMethod = (localStorage.getItem(LAST_METHOD_KEY) as PaymentMethod | null) ?? ''
    } catch { /* sin almacenamiento disponible */ }
    return { amount: '', tip: '', client: initialClient, notes: '', paymentMethod: lastMethod, paymentStatus: 'paid' }
  })
  const set = (patch: Partial<FinishDraft>) => setDraft(d => ({ ...d, ...patch }))
  const amount = toNumber(draft.amount)
  const earned = amount + toNumber(draft.tip)
  const inputClass = 'mt-1 w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-3 py-2.5 text-[#37352f] placeholder:text-[#b4b4b0] focus:border-[#37352f] focus:outline-none'

  return createPortal(
    <dialog open aria-label="Terminar trabajo" className="fixed inset-0 z-[9999] m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 sm:items-center">
      <button type="button" aria-label="Seguir trabajando" className="absolute inset-0 bg-black/50 animate-fade-in-backdrop" onClick={onCancel} />
      <form
        onSubmit={e => { e.preventDefault(); if (amount > 0 && !busy) onConfirm(draft) }}
        className="relative flex max-h-[94dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up-modal sm:rounded-2xl"
      >
        <div className="flex justify-center pt-2 sm:hidden"><span className="h-1 w-10 rounded-full bg-[rgba(55,53,47,0.2)]" /></div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5 pt-4">
          <div className="text-center">
            <div className="text-[17px] font-bold text-[#37352f]">¿Cuánto te pagaron?</div>
            <div className="mt-1 text-[13px] text-[#787774]">Trabajaste <span className="font-mono font-semibold text-[#37352f]">{formatDuration(elapsed)}</span></div>
          </div>

          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <label className="block text-[12px] font-semibold text-[#37352f]">
              Pago
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-[#9b9a97]">$</span>
                <input type="number" inputMode="decimal" step="0.01" min="0" value={draft.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" className={`${inputClass} pl-7 text-[22px] font-bold tabular-nums`} style={{ fontSize: '22px' }} autoFocus required />
              </div>
            </label>
            <label className="block text-[12px] font-semibold text-[#37352f]">
              Propina
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-[#9b9a97]">$</span>
                <input type="number" inputMode="decimal" step="0.01" min="0" value={draft.tip} onChange={e => set({ tip: e.target.value })} placeholder="0.00" className={`${inputClass} pl-7 tabular-nums`} style={{ fontSize: '16px' }} />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 divide-x divide-[rgba(55,53,47,0.08)] rounded-xl bg-[rgba(55,53,47,0.04)] py-3 text-center">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9a97]">Total</div>
              <div className="mt-0.5 text-[18px] font-bold tabular-nums text-[#0f7b6c]">{formatCurrency(earned)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9a97]">Por hora</div>
              <div className="mt-0.5 text-[18px] font-bold tabular-nums text-[#37352f]">{earned > 0 && elapsed > 0 ? formatCurrency(ratePerHour(earned, elapsed)) : '—'}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[12px] font-semibold text-[#37352f]">¿Ya te pagaron?</div>
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
          </div>

          <label className="block text-[12px] font-semibold text-[#37352f]">
            Cliente o descripción <span className="font-normal text-[#9b9a97]">(opcional)</span>
            <input type="text" value={draft.client} maxLength={80} onChange={e => set({ client: e.target.value })} placeholder="Ej: Hotel Marriott" className={inputClass} style={{ fontSize: '16px' }} />
          </label>
          <label className="block text-[12px] font-semibold text-[#37352f]">
            Notas <span className="font-normal text-[#9b9a97]">(opcional)</span>
            <textarea value={draft.notes} maxLength={500} rows={2} onChange={e => set({ notes: e.target.value })} placeholder="Ej: la propina la pagan el viernes" className={`${inputClass} resize-none`} style={{ fontSize: '16px' }} />
          </label>

          {error && <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>}
        </div>

        <div className="flex gap-2 border-t border-[rgba(55,53,47,0.09)] px-5 py-4 pb-safe">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl px-4 py-3 text-[14px] font-semibold text-[#787774] hover:bg-[rgba(55,53,47,0.06)]">
            Seguir trabajando
          </button>
          <button
            type="submit"
            disabled={amount <= 0 || busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-semibold text-white disabled:opacity-50 touch-manipulation active:scale-[0.99]"
            style={{ backgroundColor: PAY_ACCENT }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {busy ? 'Guardando…' : 'Guardar trabajo'}
          </button>
        </div>
      </form>
    </dialog>,
    document.body
  )
}

export function PaymentTimer({ onComplete }: Readonly<PaymentTimerProps>) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [jobNumber, setJobNumber] = useState('')
  const [client, setClient] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  // Elegir la hora de inicio: se olvidó iniciar ("start") o corregir el trabajo en curso ("adjust")
  const [picker, setPicker] = useState<'start' | 'adjust' | null>(null)
  // Fin del último trabajo: el siguiente no puede empezar antes
  const [lastEnd, setLastEnd] = useState<Date | null>(null)
  // Aviso de la última acción; `undoStart` permite volver al inicio anterior
  const [notice, setNotice] = useState<{ text: string; undoStart?: Date } | null>(null)

  const { startBackgroundTimer, stopBackgroundTimer } = useServiceWorker()
  const { requestWakeLock, releaseWakeLock, isActive: wakeLockActive } = useWakeLock()

  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch('/api/payment')
        const data = await res.json()
        if (!data.success || !data.data) return
        setIsRunning(data.data.isRunning)
        if (data.data.isRunning && data.data.elapsedSeconds !== undefined) {
          // Se reconstruye el inicio con lo transcurrido según el servidor (evita desfases de zona horaria)
          setStartTime(new Date(Date.now() - data.data.elapsedSeconds * 1000))
          setElapsedSeconds(data.data.elapsedSeconds)
        }
        setLastEnd(data.data.lastEndTime ? new Date(data.data.lastEndTime) : null)
        setJobNumber(data.data.jobNumber ?? '')
        setVehicleType(data.data.vehicle ?? '')
        setClient(data.data.client ?? '')
      } catch (err) {
        console.error('Error loading state:', err)
      }
    }
    loadState()
  }, [])

  useEffect(() => {
    if (!isRunning || !startTime) return
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)))
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, startTime])

  // Los avisos se van solos
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 10000)
    return () => clearTimeout(id)
  }, [notice])

  // `startAt`: se olvidó iniciar el cronómetro y empieza desde una hora anterior
  const handleStart = useCallback(async (startAt?: Date) => {
    setIsLoading(true)
    setError(null)
    try {
      await requestWakeLock()
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime: new Date().toISOString(), startTime: startAt?.toISOString() }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Error al iniciar')
        await releaseWakeLock()
        return
      }
      const newStartTime = startAt ?? new Date()
      const elapsed = Math.max(0, Math.floor((Date.now() - newStartTime.getTime()) / 1000))
      setIsRunning(true)
      setStartTime(newStartTime)
      setElapsedSeconds(elapsed)
      setJobNumber('')
      setVehicleType('')
      setClient('')
      setPicker(null)
      setNotice(startAt ? { text: `Iniciado desde las ${formatTime12(newStartTime)}: ya llevas ${formatHM(elapsed)}` } : null)
      startBackgroundTimer(newStartTime.toISOString())
    } catch (err) {
      setError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [requestWakeLock, releaseWakeLock, startBackgroundTimer])

  const handleFinish = useCallback(async (draft: FinishDraft) => {
    setIsLoading(true)
    setFinishError(null)
    try {
      if (draft.paymentMethod) {
        try { localStorage.setItem(LAST_METHOD_KEY, draft.paymentMethod) } catch { /* sin almacenamiento */ }
      }
      const res = await fetch('/api/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientTime: new Date().toISOString(),
          amount: toNumber(draft.amount),
          tip: draft.tip.trim() ? toNumber(draft.tip) : null,
          client: draft.client,
          notes: draft.notes,
          paymentMethod: draft.paymentMethod || null,
          paymentStatus: draft.paymentStatus,
          jobNumber,
          vehicle: vehicleType,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setFinishError(data.error || 'No se pudo guardar el trabajo')
        return
      }
      setIsRunning(false)
      setStartTime(null)
      setElapsedSeconds(0)
      setLastEnd(new Date())
      setPicker(null)
      setNotice(null)
      setJobNumber('')
      setVehicleType('')
      setClient('')
      setFinishing(false)
      stopBackgroundTimer()
      await releaseWakeLock()
      onComplete?.(data.data?.job ?? null)
    } catch (err) {
      setFinishError('Error de conexión')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [jobNumber, vehicleType, onComplete, stopBackgroundTimer, releaseWakeLock])

  // Corrige la hora de inicio del trabajo en curso (se inició tarde o antes de tiempo)
  const handleAdjustStart = useCallback(async (newStart: Date, isUndo = false) => {
    const previous = startTime
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setStart', startTime: newStart.toISOString() }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'No se pudo ajustar la hora de inicio')
        return
      }
      const elapsed: number = data.data.elapsedSeconds
      const realStart = new Date(Date.now() - elapsed * 1000)
      setStartTime(realStart)
      setElapsedSeconds(elapsed)
      startBackgroundTimer(realStart.toISOString())
      setPicker(null)
      setNotice(isUndo || !previous ? null : {
        text: `Inicio ajustado a las ${formatTime12(newStart)}: llevas ${formatHM(elapsed)}`,
        undoStart: previous,
      })
    } catch (err) {
      console.error('Error adjusting start:', err)
      setError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }, [startTime, startBackgroundTimer])

  // Guarda un dato del trabajo en curso; devuelve si se guardó
  const saveActive = async (patch: Record<string, string>): Promise<boolean> => {
    try {
      const res = await fetch('/api/payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!data.success) setError(data.error || 'No se pudo guardar')
      return Boolean(data.success)
    } catch {
      setError('Error de conexión')
      return false
    }
  }

  const handleSelectVehicle = (value: string) => {
    const next = vehicleType === value ? '' : value
    setVehicleType(next)
    void saveActive({ vehicle: next })
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[rgba(55,53,47,0.09)] bg-white shadow-sm">
      {isRunning && <div className="h-1 w-full animate-pulse" style={{ backgroundColor: PAY_ACCENT }} />}
      <div className="space-y-3 px-4 pb-5 pt-5">
        {/* Tiempo */}
        <div className="py-3 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#787774]">
            {isRunning ? (client || 'Trabajo en curso') : 'Trabajo por pago'}
          </div>
          <div className={`mt-1 font-mono text-[56px] font-bold leading-none tracking-tight tabular-nums transition-colors sm:text-[72px] ${isRunning ? 'text-[#37352f]' : 'text-[rgba(55,53,47,0.3)]'}`}>
            {formatDuration(elapsedSeconds)}
          </div>
          {isRunning && startTime && (
            <button
              type="button"
              onClick={() => { setError(null); setPicker(picker === 'adjust' ? null : 'adjust') }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.08)] hover:text-[#37352f] touch-manipulation"
            >
              Iniciado: {formatTime12(startTime)}
              <span className="inline-flex items-center gap-0.5 font-semibold text-[#37352f]"><Pencil className="h-3 w-3" />Ajustar</span>
            </button>
          )}
          {isRunning && wakeLockActive && (
            <div className="mt-1 flex items-center justify-center gap-1 text-[12px] text-[#787774]">
              <Smartphone className="h-3 w-3 animate-pulse" />
              Sigue contando en segundo plano
            </div>
          )}
        </div>

        {isRunning && picker === 'adjust' && (
          <StartTimePicker
            mode="adjust"
            currentStart={startTime}
            currentElapsed={elapsedSeconds}
            minStart={lastEnd}
            tone="blue"
            busy={isLoading}
            onConfirm={start => handleAdjustStart(start)}
            onCancel={() => setPicker(null)}
          />
        )}

        {isRunning && notice && (
          <div className="flex items-center justify-between gap-2 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900 animate-fade-in">
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 flex-shrink-0" />{notice.text}</span>
            {notice.undoStart && (
              <button
                type="button"
                onClick={() => notice.undoStart && handleAdjustStart(notice.undoStart, true)}
                disabled={isLoading}
                className="flex flex-shrink-0 items-center gap-1 rounded-[4px] px-2 py-1 font-semibold hover:bg-emerald-100 disabled:opacity-60"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Deshacer
              </button>
            )}
          </div>
        )}

        {/* Datos del trabajo en curso */}
        {isRunning && (
          <div className="space-y-2">
            <InlineField
              icon={<User className="h-3.5 w-3.5" />}
              label="Cliente"
              value={client}
              placeholder="Agregar cliente"
              onSave={async value => { const ok = await saveActive({ client: value }); if (ok) setClient(value); return ok }}
            />
            <InlineField
              icon={<Hash className="h-3.5 w-3.5" />}
              label="Trabajo #"
              value={jobNumber}
              placeholder="Asignar número"
              mono
              onSave={async value => { const ok = await saveActive({ jobNumber: value }); if (ok) setJobNumber(value); return ok }}
            />
            <div className="rounded-[8px] border border-[rgba(55,53,47,0.09)] p-3">
              <div className="mb-2 flex items-center gap-2 text-[13px] text-[#787774]"><Bus className="h-3.5 w-3.5" />Vehículo</div>
              <div className="grid grid-cols-3 gap-1.5">
                {VEHICLES.map(v => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => handleSelectVehicle(v.value)}
                    className={`truncate rounded-[4px] px-2 py-2 text-[13px] transition-colors touch-manipulation ${vehicleType === v.value ? 'bg-[#37352f] text-white' : 'border border-[rgba(55,53,47,0.16)] text-[#37352f] hover:bg-[rgba(55,53,47,0.06)]'}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <div className="rounded-[4px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>}

        {/* Botones */}
        {isRunning ? (
          <button
            type="button"
            onClick={() => { setFinishError(null); setFinishing(true) }}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-[8px] py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60 touch-manipulation active:scale-[0.99]"
            style={{ backgroundColor: PAY_ACCENT }}
          >
            <Square className="h-4 w-4" />
            TERMINAR Y ANOTAR EL PAGO
          </button>
        ) : picker === 'start' ? (
          <StartTimePicker
            mode="start"
            minStart={lastEnd}
            tone="blue"
            busy={isLoading}
            onConfirm={start => handleStart(start)}
            onCancel={() => setPicker(null)}
          />
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleStart()}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#37352f] py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#2f2d28] disabled:opacity-60 touch-manipulation active:scale-[0.99]"
            >
              <Play className="h-4 w-4" />
              {isLoading ? 'Iniciando...' : 'INICIAR TRABAJO'}
            </button>
            <button
              type="button"
              onClick={() => { setError(null); setPicker('start') }}
              className="flex w-full flex-wrap items-center justify-center gap-x-1.5 py-1 text-[12px] text-[#787774] transition-colors hover:text-[#37352f] touch-manipulation"
            >
              <History className="h-3.5 w-3.5" />
              ¿Se te olvidó iniciarlo?
              <span className="font-semibold text-[#37352f] underline underline-offset-2">Empieza desde una hora anterior</span>
            </button>
          </div>
        )}
      </div>

      {finishing && (
        <FinishSheet
          elapsed={elapsedSeconds}
          initialClient={client}
          busy={isLoading}
          error={finishError}
          onConfirm={handleFinish}
          onCancel={() => setFinishing(false)}
        />
      )}
    </div>
  )
}
