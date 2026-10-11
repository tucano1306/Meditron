'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, History, Play, X, Check } from 'lucide-react'
import { formatCurrency, formatDuration, floridaWallTimeToUTC, getFloridaDateComponents } from '@/lib/utils'
import { formatTime12 } from '@/lib/report-format'
import { formatHM } from '@/lib/display'

// Elegir a qué hora empezó el turno: para cuando se olvidó iniciar el cronómetro
// (mode "start") o para corregir el inicio del turno en curso (mode "adjust").

/** Igual que el servidor: no más de 24 h atrás */
const MAX_BACKDATE_MS = 24 * 3600 * 1000

interface StartTimePickerProps {
  readonly mode: 'start' | 'adjust'
  /** Inicio actual del turno en curso (al ajustar) */
  readonly currentStart?: Date | null
  /** Tiempo trabajado ahora mismo (al ajustar; descuenta pausas) */
  readonly currentElapsed?: number
  /** Fin del último turno: el nuevo no puede empezar antes */
  readonly minStart: Date | null
  /** $/hora para el monto aproximado (sin tarifa no se muestra, p. ej. por pago) */
  readonly rate?: number
  readonly companyName?: string
  /** Color de los botones: el gris de la app o el azul del modo por pago */
  readonly tone?: 'neutral' | 'blue'
  readonly busy: boolean
  readonly error?: string | null
  readonly onConfirm: (start: Date) => void
  readonly onCancel: () => void
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** "HH:MM" de un instante en hora de Florida (para el campo de hora) */
function toTimeInput(date: Date): string {
  const { hour, minute } = getFloridaDateComponents(date)
  return `${String(hour % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** La hora elegida es de hoy; si todavía no llega, es de ayer (turno que cruzó la medianoche) */
function fromTimeInput(value: string, now: number): Date | null {
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const today = getFloridaDateComponents(new Date(now))
  let date = floridaWallTimeToUTC(today.year, today.month, today.day, h, m)
  if (date.getTime() > now) date = floridaWallTimeToUTC(today.year, today.month, today.day - 1, h, m)
  return date
}

function isAnotherDay(date: Date, now: number): boolean {
  const a = getFloridaDateComponents(date)
  const b = getFloridaDateComponents(new Date(now))
  return a.year !== b.year || a.month !== b.month || a.day !== b.day
}

function minutesAgo(minutes: number, base: number): Date {
  return new Date(base - minutes * 60 * 1000)
}

/** Atajo ("X min antes") o una hora exacta */
type Selection = { minutes: number } | { at: Date }

const TONES = {
  neutral: { border: 'border-[#37352f]', chip: 'bg-[#37352f] text-white', button: 'bg-[#37352f] hover:bg-[#2f2d28]' },
  blue: { border: 'border-blue-300', chip: 'bg-blue-600 text-white', button: 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700' },
}

export function StartTimePicker({ mode, currentStart, currentElapsed = 0, minStart, rate, companyName, tone = 'neutral', busy, error, onConfirm, onCancel }: StartTimePickerProps) {
  const colors = TONES[tone]
  const now = useNow()
  const [selection, setSelection] = useState<Selection>(() => (mode === 'adjust' && currentStart ? { at: currentStart } : { minutes: 15 }))

  // Atajos: al iniciar, "hace X min"; al ajustar, X min antes del inicio actual
  const base = mode === 'adjust' && currentStart ? currentStart.getTime() : now
  const choice = 'at' in selection ? selection.at : minutesAgo(selection.minutes, base)
  const shortcuts = mode === 'adjust'
    ? [5, 10, 15, 30, 60].map(m => ({ minutes: m, label: `−${m >= 60 ? '1 h' : `${m} min`}` }))
    : [10, 15, 30, 45, 60, 120].map(m => ({ minutes: m, label: m >= 60 ? `Hace ${m / 60} h` : `Hace ${m} min` }))

  const added = mode === 'adjust' && currentStart ? Math.round((currentStart.getTime() - choice.getTime()) / 1000) : 0
  const previewSeconds = mode === 'adjust'
    ? Math.max(0, currentElapsed + added)
    : Math.max(0, Math.floor((now - choice.getTime()) / 1000))

  let problem: string | null = null
  if (choice.getTime() > now + 60 * 1000) problem = 'Esa hora todavía no llega.'
  else if (choice.getTime() < now - MAX_BACKDATE_MS) problem = 'Solo puedes ir hasta 24 horas atrás.'
  const overlaps = minStart !== null && choice.getTime() < minStart.getTime() - 60 * 1000
  const unchanged = mode === 'adjust' && added === 0
  const canConfirm = !problem && !overlaps && !unchanged && !busy

  const choiceLabel = `${isAnotherDay(choice, now) ? 'ayer ' : ''}${formatTime12(choice)}`

  return (
    <div className={`rounded-[10px] border ${colors.border} bg-white p-4 text-left shadow-sm space-y-4 animate-fade-in`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(55,53,47,0.06)] text-[#37352f]">
            <History className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[14px] font-semibold text-[#37352f]">
              {mode === 'adjust' ? 'Ajustar la hora de inicio' : '¿A qué hora empezaste?'}
            </div>
            <div className="text-[12px] text-[#787774]">
              {mode === 'adjust'
                ? 'Si lo iniciaste tarde, mueve el inicio a la hora real.'
                : `El cronómetro${companyName ? ` de ${companyName}` : ''} cuenta desde esa hora.`}
            </div>
          </div>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cerrar" className="rounded-[4px] p-1 text-[#787774] hover:bg-[rgba(55,53,47,0.08)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Atajos */}
      <div className="flex flex-wrap gap-1.5">
        {shortcuts.map(s => {
          const active = 'minutes' in selection && selection.minutes === s.minutes
          return (
            <button
              key={s.minutes}
              type="button"
              onClick={() => setSelection({ minutes: s.minutes })}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors touch-manipulation ${active ? colors.chip : 'bg-[rgba(55,53,47,0.06)] text-[#37352f] hover:bg-[rgba(55,53,47,0.12)]'}`}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Hora exacta */}
      <label className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(55,53,47,0.12)] px-3 py-2">
        <span className="text-[13px] text-[#787774]">O elige la hora exacta</span>
        <span className="flex items-center gap-2">
          {isAnotherDay(choice, now) && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">ayer</span>}
          <input
            type="time"
            value={toTimeInput(choice)}
            onChange={e => {
              const next = fromTimeInput(e.target.value, Date.now())
              if (next) setSelection({ at: next })
            }}
            className="rounded-[4px] border border-[rgba(55,53,47,0.16)] px-2 py-1 text-[#37352f] focus:border-[#37352f] focus:outline-none"
            style={{ fontSize: '16px' }}
          />
        </span>
      </label>

      {/* Vista previa en vivo */}
      <div className="rounded-lg bg-[rgba(55,53,47,0.04)] px-3 py-3 text-center">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#787774]">
          {mode === 'adjust' ? 'Tu turno quedará en' : 'Llevarás trabajando'}
        </div>
        <div className="mt-1 font-mono text-[30px] font-bold leading-none tabular-nums text-[#37352f]">
          {formatDuration(previewSeconds)}
        </div>
        {(rate !== undefined || (mode === 'adjust' && added !== 0)) && (
          <div className="mt-1.5 text-[12px] text-[#787774] tabular-nums">
            {rate !== undefined && `≈ ${formatCurrency((previewSeconds / 3600) * rate)}`}
            {mode === 'adjust' && added !== 0 && (
              <span className={`ml-2 font-semibold ${added > 0 ? 'text-emerald-700' : 'text-[#9a4a0b]'}`}>
                {added > 0 ? '+' : '−'}{formatHM(Math.abs(added))}
              </span>
            )}
          </div>
        )}
      </div>

      {(problem || overlaps) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <div className="space-y-1">
            {problem ?? `Tu turno anterior terminó a las ${formatTime12(minStart as Date)}: el nuevo no puede empezar antes.`}
            {!problem && overlaps && minStart && (
              <button
                type="button"
                onClick={() => setSelection({ at: minStart })}
                className="block font-semibold underline underline-offset-2"
              >
                Empezar a las {formatTime12(minStart)}
              </button>
            )}
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>
      )}

      <button
        type="button"
        onClick={() => onConfirm(choice)}
        disabled={!canConfirm}
        className={`flex w-full items-center justify-center gap-2 rounded-[6px] ${colors.button} py-3 text-[15px] font-semibold text-white transition-colors disabled:opacity-50 touch-manipulation active:scale-[0.99]`}
      >
        {mode === 'adjust' ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {busy && (mode === 'adjust' ? 'Guardando...' : 'Iniciando...')}
        {!busy && (mode === 'adjust' ? `Empezó a las ${choiceLabel}` : `Iniciar desde las ${choiceLabel}`)}
      </button>
    </div>
  )
}
