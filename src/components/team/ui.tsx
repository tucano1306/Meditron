'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Piezas comunes del modo empresa

export const inputClass = 'mt-0.5 w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-3 py-2 text-[#37352f] placeholder:text-[#b4b4b0] focus:border-[#37352f] focus:outline-none'
export const labelClass = 'block text-[11px] text-[#787774]'
export const cardClass = 'rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-4 shadow-sm'
export const primaryButton = 'flex items-center justify-center gap-1.5 rounded-xl bg-[#37352f] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2f2d28] disabled:opacity-50 touch-manipulation'
export const secondaryButton = 'flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(55,53,47,0.16)] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#37352f] transition-colors hover:bg-[rgba(55,53,47,0.04)] disabled:opacity-50 touch-manipulation'

/** Pide JSON al servidor; devuelve los datos o el mensaje de error */
export async function api<T = unknown>(url: string, method = 'GET', body?: unknown): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json()
    return json.success ? { data: json.data as T, error: null, status: res.status } : { data: null, error: json.error || 'Algo salió mal', status: res.status }
  } catch {
    return { data: null, error: 'Error de conexión', status: 0 }
  }
}

export function ErrorBox({ children }: { readonly children: ReactNode }) {
  if (!children) return null
  return <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{children}</div>
}

export function SuccessBox({ children }: { readonly children: ReactNode }) {
  if (!children) return null
  return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800 animate-fade-in">{children}</div>
}

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray'
const TONES: Record<Tone, string> = {
  green: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-300 bg-amber-50 text-amber-800',
  red: 'border-red-300 bg-red-50 text-red-700',
  blue: 'border-blue-300 bg-blue-50 text-blue-700',
  gray: 'border-[rgba(55,53,47,0.16)] bg-[rgba(55,53,47,0.04)] text-[#787774]',
}

export function Pill({ tone, children }: { readonly tone: Tone; readonly children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${TONES[tone]}`}>{children}</span>
}

/** Hoja que sube desde abajo (en el teléfono) o ventana centrada (en la computadora) */
export function Sheet({ title, subtitle, onClose, children }: { readonly title: string; readonly subtitle?: string; readonly onClose: () => void; readonly children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <dialog open aria-label={title} className="fixed inset-0 z-[9999] m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 sm:items-center">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/50 animate-fade-in-backdrop" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up-modal sm:max-h-[90dvh] sm:rounded-2xl">
        <div className="flex justify-center pt-2 sm:hidden"><span className="h-1 w-10 rounded-full bg-[rgba(55,53,47,0.2)]" /></div>
        <div className="flex items-start gap-2 border-b border-[rgba(55,53,47,0.09)] px-5 pb-3 pt-3 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-bold text-[#37352f]">{title}</h2>
            {subtitle && <p className="truncate text-[12px] text-[#787774]">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-xl bg-[rgba(55,53,47,0.06)] p-2 text-[#787774] hover:bg-[rgba(55,53,47,0.12)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-safe">{children}</div>
      </div>
    </dialog>,
    document.body
  )
}

/** "3h 05m" */
export function hm(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, '0')}m`
}
