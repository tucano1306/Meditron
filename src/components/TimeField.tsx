'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'

// Campo de hora con selector propio (ruedas de hora, minutos y AM/PM).
// Reemplaza <input type="time">: el selector nativo de Android corta sus
// botones con letra grande y no se puede arreglar desde la página.
// El valor es "HH:MM" en 24 horas, igual que el input nativo.

const ITEM_H = 44
const VISIBLE = 5
const PAD = ((VISIBLE - 1) / 2) * ITEM_H

// Como en un reloj: 12, 1, 2 … 11 (la posición i es la hora i, y la 0 es el 12)
const HOURS = Array.from({ length: 12 }, (_, i) => String(i || 12))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const PERIODS = ['AM', 'PM']

interface Parts { hour: number; minute: number; pm: boolean }

function parse(value: string): Parts {
  const [h, m] = value.split(':').map(Number)
  const hour24 = Number.isInteger(h) && h >= 0 && h < 24 ? h : 9
  return { hour: hour24 % 12 || 12, minute: Number.isInteger(m) && m >= 0 && m < 60 ? m : 0, pm: hour24 >= 12 }
}

function toValue({ hour, minute, pm }: Parts): string {
  return `${String((hour % 12) + (pm ? 12 : 0)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** "9:56 AM" */
export function formatTimeValue(value: string): string {
  if (!value) return ''
  const { hour, minute, pm } = parse(value)
  return `${hour}:${String(minute).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`
}

interface WheelProps {
  readonly items: string[]
  readonly selected: number
  readonly label: string
  readonly onSelect: (index: number) => void
}

/** Columna que se desliza y se detiene en el valor del centro */
function Wheel({ items, selected, label, onSelect }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const initial = useRef(selected)

  // Solo al abrir: centra el valor actual (después la rueda manda)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = initial.current * ITEM_H
  }, [])

  const scrollToIndex = (index: number) => {
    ref.current?.scrollTo({ top: Math.max(0, Math.min(items.length - 1, index)) * ITEM_H, behavior: 'smooth' })
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={e => {
        const index = Math.max(0, Math.min(items.length - 1, Math.round(e.currentTarget.scrollTop / ITEM_H)))
        if (index !== selected) onSelect(index)
      }}
      onKeyDown={e => {
        if (e.key === 'ArrowUp') { e.preventDefault(); scrollToIndex(selected - 1) }
        if (e.key === 'ArrowDown') { e.preventDefault(); scrollToIndex(selected + 1) }
      }}
      className="relative z-10 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-[#37352f]/30 [&::-webkit-scrollbar]:hidden"
      style={{ height: VISIBLE * ITEM_H, paddingTop: PAD, paddingBottom: PAD }}
    >
      {items.map((item, i) => {
        const distance = Math.abs(i - selected)
        return (
          <button
            key={item}
            type="button"
            role="option"
            aria-selected={i === selected}
            tabIndex={-1}
            onClick={() => scrollToIndex(i)}
            className={`flex w-full snap-center items-center justify-center font-mono tabular-nums transition-all duration-150 touch-manipulation ${
              i === selected ? 'text-[24px] font-bold text-[#37352f]' : distance === 1 ? 'text-[18px] text-[#787774]' : 'text-[15px] text-[#b4b4b0]'
            }`}
            style={{ height: ITEM_H }}
          >
            {item}
          </button>
        )
      })}
    </div>
  )
}

interface TimeSheetProps {
  readonly title: string
  readonly value: string
  readonly accent: string
  readonly onDone: (value: string) => void
  readonly onClose: () => void
}

function TimeSheet({ title, value, accent, onDone, onClose }: TimeSheetProps) {
  const [parts, setParts] = useState<Parts>(() => parse(value))

  // Escape cierra solo este selector (no la hoja que lo contiene)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <dialog open aria-label={title} className="fixed inset-0 z-[10000] m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 sm:items-center">
      <button type="button" aria-label="Cancelar" className="absolute inset-0 bg-black/50 animate-fade-in-backdrop" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-3xl bg-white px-5 pt-2 shadow-2xl animate-slide-up-modal pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:pt-5">
        <div className="flex justify-center pb-2 sm:hidden"><span className="h-1 w-10 rounded-full bg-[rgba(55,53,47,0.2)]" /></div>
        <div className="text-center">
          <div className="text-[13px] font-medium text-[#787774]">{title}</div>
          <div className="mt-1 font-mono text-[40px] font-bold leading-none tabular-nums text-[#37352f]" aria-live="polite">
            {formatTimeValue(toValue(parts))}
          </div>
        </div>

        <div className="relative mt-5 flex gap-1">
          {/* Franja del valor elegido y degradados arriba y abajo */}
          <div className="pointer-events-none absolute inset-x-0 rounded-xl bg-[rgba(55,53,47,0.06)]" style={{ top: PAD, height: ITEM_H }} />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-white to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-white to-transparent" />
          <Wheel items={HOURS} selected={parts.hour % 12} label="Hora" onSelect={i => setParts(p => ({ ...p, hour: i || 12 }))} />
          <div className="relative z-10 flex items-center text-[22px] font-bold text-[#37352f]" style={{ height: VISIBLE * ITEM_H }}>:</div>
          <Wheel items={MINUTES} selected={parts.minute} label="Minutos" onSelect={i => setParts(p => ({ ...p, minute: i }))} />
          <Wheel items={PERIODS} selected={parts.pm ? 1 : 0} label="AM o PM" onSelect={i => setParts(p => ({ ...p, pm: i === 1 }))} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[rgba(55,53,47,0.06)] py-3 text-[15px] font-semibold text-[#37352f] transition-colors hover:bg-[rgba(55,53,47,0.12)] touch-manipulation"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onDone(toValue(parts))}
            className="rounded-xl py-3 text-[15px] font-semibold text-white transition-transform active:scale-[0.98] touch-manipulation"
            style={{ backgroundColor: accent }}
          >
            Listo
          </button>
        </div>
      </div>
    </dialog>,
    document.body
  )
}

interface TimeFieldProps {
  /** "HH:MM" (24 h) */
  readonly value: string
  readonly onChange: (value: string) => void
  /** Título del selector, p. ej. "¿A qué hora empezaste?" */
  readonly title: string
  readonly className?: string
  /** Color del botón "Listo" */
  readonly accent?: string
}

export function TimeField({ value, onChange, title, className = '', accent = '#37352f' }: TimeFieldProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${title}: ${formatTimeValue(value) || 'sin hora'}`}
        className={`flex items-center justify-between gap-2 text-left tabular-nums touch-manipulation ${className}`}
      >
        <span className={value ? 'text-[#37352f]' : 'text-[#b4b4b0]'}>{formatTimeValue(value) || '--:--'}</span>
        <Clock className="h-4 w-4 flex-shrink-0 text-[#787774]" />
      </button>
      {open && (
        <TimeSheet
          title={title}
          value={value}
          accent={accent}
          onDone={next => { onChange(next); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
