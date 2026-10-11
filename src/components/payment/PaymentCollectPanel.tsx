'use client'

import { useState } from 'react'
import { Check, CheckCircle2, Hourglass, Loader2 } from 'lucide-react'
import { formatCurrency, getFloridaDateString } from '@/lib/utils'
import { formatKeyShort } from '@/lib/report-format'
import { addDaysToKey } from '@/lib/companies'
import { jobEarned, PAYMENT_METHODS, summarizeJobs, type PaymentJob, type PaymentMethod } from '@/lib/payment-jobs'
import { useFetchData, type JobsResult } from './data'
import { JobCard } from './PaymentJobsPanel'
import { METHOD_ICONS } from './shared'

function daysAgo(dateKey: string, today: string): number {
  let days = 0
  for (let key = dateKey; key < today && days < 3650; key = addDaysToKey(key, 1)) days += 1
  return days
}

interface PaymentCollectPanelProps {
  readonly refreshKey: number
  readonly onOpen: (job: PaymentJob) => void
  /** Se cobraron (o se deshizo el cobro de) trabajos; `undo` revierte */
  readonly onChanged: (message: string, undo?: () => Promise<void>) => void
}

export function PaymentCollectPanel({ refreshKey, onOpen, onChanged }: PaymentCollectPanelProps) {
  const today = getFloridaDateString()
  const { data, loading } = useFetchData<JobsResult>(`/api/payment/jobs?status=pending&r=${refreshKey}`)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const jobs = data?.jobs ?? []
  // Lo que ya no está pendiente se quita de la selección
  const chosen = jobs.filter(j => selected.has(j.id))
  const totals = summarizeJobs(jobs)
  const chosenTotal = chosen.reduce((sum, j) => sum + jobEarned(j), 0)
  const oldest = jobs.reduce<string | null>((min, j) => (!min || j.date < min ? j.date : min), null)

  const groups = new Map<string, PaymentJob[]>()
  for (const job of [...jobs].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = job.client ?? 'Sin cliente'
    groups.set(key, [...(groups.get(key) ?? []), job])
  }

  const toggle = (ids: string[], on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const setStatus = async (ids: string[], status: 'paid' | 'pending', paymentMethod?: PaymentMethod | null) => {
    const res = await fetch('/api/payment/jobs/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status, paymentMethod: paymentMethod ?? undefined }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'No se pudo actualizar')
  }

  const collect = async (list: PaymentJob[]) => {
    if (list.length === 0) return
    setBusy(true)
    setError(null)
    const ids = list.map(j => j.id)
    const total = list.reduce((sum, j) => sum + jobEarned(j), 0)
    try {
      await setStatus(ids, 'paid', method)
      setSelected(new Set())
      onChanged(
        `${list.length === 1 ? 'Trabajo cobrado' : `${list.length} trabajos cobrados`} · ${formatCurrency(total)}`,
        () => setStatus(ids, 'pending'),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setBusy(false)
    }
  }

  if (!data && loading) {
    return <div className="h-48 rounded-xl border border-[rgba(55,53,47,0.09)] bg-white animate-pulse" />
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 animate-pop-in" />
        <p className="mt-3 text-[16px] font-bold text-emerald-900">Todo cobrado</p>
        <p className="mt-1 text-[13px] text-emerald-800/80">
          Cuando guardes un trabajo como “por cobrar”, aparecerá aquí para que no se te olvide.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Total por cobrar */}
      <section className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-amber-800">
          <Hourglass className="h-3.5 w-3.5" /> Te deben
        </div>
        <div className="mt-1 text-[34px] font-bold leading-none tabular-nums text-amber-700">{formatCurrency(totals.earned)}</div>
        <div className="mt-2 text-[13px] text-[#787774]">
          {totals.count} {totals.count === 1 ? 'trabajo' : 'trabajos'}
          {oldest && ` · el más antiguo es del ${formatKeyShort(oldest)}${daysAgo(oldest, today) > 0 ? ` (hace ${daysAgo(oldest, today)} días)` : ''}`}
        </div>
        <button
          type="button"
          onClick={() => toggle(jobs.map(j => j.id), chosen.length !== jobs.length)}
          className="mt-3 text-[13px] font-semibold text-amber-800 underline underline-offset-2"
        >
          {chosen.length === jobs.length ? 'Quitar selección' : 'Seleccionar todos'}
        </button>
      </section>

      {/* Por cliente */}
      {[...groups.entries()].map(([client, list]) => {
        const subtotal = list.reduce((sum, j) => sum + jobEarned(j), 0)
        const allChosen = list.every(j => selected.has(j.id))
        return (
          <section key={client} className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <label className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-[#37352f] touch-manipulation">
                <input type="checkbox" checked={allChosen} onChange={e => toggle(list.map(j => j.id), e.target.checked)} className="h-4 w-4 accent-amber-600" />
                <span className="truncate">{client}</span>
                <span className="font-normal text-[#787774] tabular-nums">· {formatCurrency(subtotal)}</span>
              </label>
              <button
                type="button"
                onClick={() => collect(list)}
                disabled={busy}
                className="flex-shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                Cobrar {list.length > 1 ? 'todo' : ''}
              </button>
            </div>
            {list.map(job => (
              <div key={job.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(job.id)}
                  onChange={e => toggle([job.id], e.target.checked)}
                  aria-label="Seleccionar trabajo"
                  className="h-5 w-5 flex-shrink-0 accent-amber-600"
                />
                <div className="min-w-0 flex-1">
                  <JobCard job={job} onOpen={onOpen} />
                </div>
              </div>
            ))}
          </section>
        )
      })}

      {error && <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{error}</div>}

      {/* Barra para cobrar lo elegido */}
      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[rgba(55,53,47,0.09)] bg-white/95 px-4 pb-safe pt-3 shadow-[0_-8px_24px_-12px_rgba(15,15,15,0.25)] backdrop-blur animate-slide-up">
          <div className="mx-auto max-w-3xl space-y-2 pb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="flex-shrink-0 text-[12px] text-[#787774]">Te pagaron con:</span>
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(method === m.value ? null : m.value)}
                  className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${method === m.value ? 'bg-[#37352f] text-white' : 'bg-[rgba(55,53,47,0.06)] text-[#37352f]'}`}
                >
                  {METHOD_ICONS[m.value]}
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => collect(chosen)}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-[15px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 touch-manipulation active:scale-[0.99]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Marcar {chosen.length} como cobrado · {formatCurrency(chosenTotal)}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
