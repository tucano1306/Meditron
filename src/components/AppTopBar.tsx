'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, DollarSign, Settings } from 'lucide-react'
import { PAY_ACCENT } from './payment/shared'

// Barra de arriba de la app: el logo (lleva al inicio), el interruptor entre
// Por Hora y Por Pago, y el botón de Configuración.

export type AppMode = 'hourly' | 'payment'

const MODE_STORAGE_KEY = 'meditron_mode'
const HOME = '/mode-select'
const MODES: { value: AppMode; label: string; href: string; color: string; icon: typeof Clock }[] = [
  { value: 'hourly', label: 'Por Hora', href: HOME, color: '#37352f', icon: Clock },
  { value: 'payment', label: 'Por Pago', href: '/dashboard/payment', color: PAY_ACCENT, icon: DollarSign },
]
/** Lo que tarda la píldora en deslizarse antes de cambiar de pantalla */
const SLIDE_MS = 220

interface ModeSwitchProps {
  readonly active: AppMode
}

/** Interruptor Por Hora ⇄ Por Pago: la píldora se desliza y cambia de modo */
export function ModeSwitch({ active }: ModeSwitchProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<AppMode>(active)
  const index = MODES.findIndex(m => m.value === selected)
  const color = MODES[index].color

  useEffect(() => {
    for (const mode of MODES) if (mode.value !== active) router.prefetch(mode.href)
  }, [active, router])

  // Mientras se desliza, al tocar el que ya está elegido no pasa nada
  useEffect(() => {
    if (selected === active) return
    const href = MODES.find(m => m.value === selected)!.href
    const id = setTimeout(() => router.push(href), SLIDE_MS)
    return () => clearTimeout(id)
  }, [selected, active, router])

  const choose = (mode: AppMode) => {
    if (mode === selected) return
    try { localStorage.setItem(MODE_STORAGE_KEY, mode) } catch { /* sin almacenamiento */ }
    setSelected(mode)
  }

  return (
    <nav aria-label="Modo" className="relative grid h-9 w-[208px] grid-cols-2 rounded-full bg-[rgba(55,53,47,0.07)] p-1 sm:w-[236px]">
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full shadow-[0_1px_3px_rgba(15,15,15,0.18)] transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: `translateX(${index * 100}%)`, backgroundColor: color }}
      />
      {MODES.map(mode => {
        const Icon = mode.icon
        const on = mode.value === selected
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => choose(mode.value)}
            aria-current={mode.value === active ? 'page' : undefined}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors duration-300 touch-manipulation ${on ? 'text-white' : 'text-[#787774] hover:text-[#37352f]'}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {mode.label}
          </button>
        )
      })}
    </nav>
  )
}

interface AppTopBarProps {
  /** Modo de la pantalla; sin modo (como en Configuración) no sale el interruptor */
  readonly mode?: AppMode
  /** Fondo de la barra (el de la pantalla) */
  readonly surface?: 'white' | 'canvas'
}

export function AppTopBar({ mode, surface = 'canvas' }: AppTopBarProps) {
  const background = surface === 'white' ? 'bg-white/85' : 'bg-[#fbfbfa]/85'
  return (
    <header className={`sticky top-0 z-20 border-b border-[rgba(55,53,47,0.07)] ${background} backdrop-blur-md`}>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5">
        <Link
          href={HOME}
          aria-label="Inicio"
          title="Inicio"
          className="-ml-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-[rgba(55,53,47,0.08)] touch-manipulation"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#37352f] shadow-sm">
            <Clock className="h-4 w-4 text-white" />
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-[#37352f] sm:inline">Meditron</span>
        </Link>

        {mode && <ModeSwitch active={mode} />}

        <Link
          href="/settings"
          aria-label="Configuración"
          title="Configuración"
          className="group -mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.08)] hover:text-[#37352f] touch-manipulation"
        >
          <Settings className="h-[18px] w-[18px] transition-transform duration-500 group-hover:rotate-90" />
        </Link>
      </div>
    </header>
  )
}
