'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive, ArchiveRestore, ArrowLeft, Briefcase, Building2, CalendarDays, Check, ChevronRight, Loader2, Plus, Shuffle, Trash2, X,
} from 'lucide-react'
import { COMPANY_COLORS, getPayPeriod } from '@/lib/companies'
import { formatCurrency, getFloridaDateString } from '@/lib/utils'
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payment-jobs'
import { PAY_COMPANY_TYPES, countLabel, describePay, shortMoney, type PayCompany, type PayCompanyType } from '@/lib/pay-companies'
import { METHOD_ICONS, PAY_ACCENT } from './shared'

// Hoja para crear y configurar las compañías del modo "Por pago": quién te
// paga, cuánto (por día, por trabajo o variable) y cuándo.

interface PayCompanyManagerProps {
  readonly companies: PayCompany[]
  /** Abre directamente el formulario de una compañía nueva */
  readonly startCreating?: boolean
  readonly onClose: () => void
  /** Se creó o cambió una compañía; `created` es la nueva */
  readonly onChanged: (message: string, created?: PayCompany) => void
}

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; id: string }

interface Draft {
  name: string
  color: string
  payType: PayCompanyType
  rate: string
  paysLater: boolean
  paymentMethod: PaymentMethod | ''
}

const TYPE_ICONS: Record<PayCompanyType, React.ReactNode> = {
  per_day: <CalendarDays className="h-4 w-4" />,
  per_job: <Briefcase className="h-4 w-4" />,
  variable: <Shuffle className="h-4 w-4" />,
}

const inputClass = 'mt-1 w-full rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-3 py-2.5 text-[#37352f] placeholder:text-[#b4b4b0] focus:border-[#37352f] focus:outline-none'
const labelClass = 'block text-[12px] font-semibold text-[#37352f]'

function draftOf(company?: PayCompany): Draft {
  return {
    name: company?.name ?? '',
    color: company?.color ?? PAY_ACCENT,
    payType: company?.payType ?? 'per_day',
    rate: company?.rate ? String(company.rate) : '',
    paysLater: company?.paysLater ?? true,
    paymentMethod: company?.paymentMethod ?? '',
  }
}

function rateOf(draft: Draft): number {
  const n = Number.parseFloat(draft.rate)
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function sendJson(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json()
    return json.success ? { ok: true, data: json.data } : { ok: false, error: json.error || 'No se pudo guardar' }
  } catch {
    return { ok: false, error: 'Error de conexión' }
  }
}

/** Lo que va a pasar con esta configuración, en una frase */
function Preview({ draft }: { readonly draft: Draft }) {
  const name = draft.name.trim() || 'esta compañía'
  const rate = rateOf(draft)
  const state = draft.paysLater ? 'por cobrar' : 'como cobrados'
  let text: React.ReactNode
  if (draft.payType === 'per_day') {
    text = rate > 0
      ? <>Cada día que trabajes con <b>{name}</b> se anotan <b>{shortMoney(rate)}</b> {state}, aunque hagas varios registros ese día. Verás cuánto te sale por hora.</>
      : <>Escribe cuánto te paga {name} por día.</>
  } else if (draft.payType === 'per_job') {
    text = rate > 0
      ? <>Cada trabajo con <b>{name}</b> se anota con <b>{shortMoney(rate)}</b> {state}. Si uno paga distinto, lo cambias al guardarlo.</>
      : <>Escribe cuánto te paga {name} por trabajo.</>
  } else {
    text = <>Al terminar cada trabajo con <b>{name}</b> escribes cuánto te pagó. Se guardan {state}.</>
  }
  return (
    <div className="flex gap-2.5 rounded-xl border px-3 py-2.5 text-[12px] leading-relaxed text-[#37352f]" style={{ borderColor: `${draft.color}55`, backgroundColor: `${draft.color}0d` }}>
      <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: draft.color }} />
      <span>{text}</span>
    </div>
  )
}

function CompanyFields({ draft, onChange, autoFocus }: { readonly draft: Draft; readonly onChange: (draft: Draft) => void; readonly autoFocus: boolean }) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })
  const type = PAY_COMPANY_TYPES.find(t => t.value === draft.payType) ?? PAY_COMPANY_TYPES[0]

  return (
    <div className="space-y-5">
      <label className={labelClass}>
        Nombre
        <input
          type="text"
          value={draft.name}
          maxLength={60}
          onChange={e => set({ name: e.target.value })}
          placeholder="Ej: Transportes López"
          className={inputClass}
          style={{ fontSize: '16px' }}
          autoFocus={autoFocus}
        />
      </label>

      <div>
        <div className={labelClass}>Color</div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {[PAY_ACCENT, ...COMPANY_COLORS.filter(c => c !== PAY_ACCENT)].map(color => (
            <button
              key={color}
              type="button"
              onClick={() => set({ color })}
              aria-label={`Color ${color}`}
              aria-pressed={draft.color === color}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform touch-manipulation ${draft.color === color ? 'scale-110 ring-2 ring-offset-2' : 'hover:scale-105'}`}
              style={{ backgroundColor: color, ['--tw-ring-color' as string]: color }}
            >
              {draft.color === color && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={labelClass}>¿Cómo te paga?</div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Cómo te paga">
          {PAY_COMPANY_TYPES.map(option => {
            const active = draft.payType === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ payType: option.value })}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-[13px] font-semibold transition-all touch-manipulation ${active ? 'border-transparent text-white shadow-sm' : 'border-[rgba(55,53,47,0.16)] text-[#37352f] hover:bg-[rgba(55,53,47,0.04)]'}`}
                style={active ? { backgroundColor: PAY_ACCENT } : undefined}
              >
                {TYPE_ICONS[option.value]}
                {option.label}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[12px] text-[#787774]">{type.help}</p>
      </div>

      {draft.payType !== 'variable' && (
        <label className={labelClass}>
          {draft.payType === 'per_day' ? 'Te paga por día' : 'Te paga por trabajo'}
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-[#9b9a97]">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={draft.rate}
              onChange={e => set({ rate: e.target.value })}
              placeholder="0.00"
              className={`${inputClass} pl-7 text-[20px] font-bold tabular-nums`}
              style={{ fontSize: '20px' }}
            />
          </div>
        </label>
      )}

      <div>
        <div className={labelClass}>¿Cuándo te paga?</div>
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-[rgba(55,53,47,0.06)] p-1" role="radiogroup" aria-label="Cuándo te paga">
          {([[true, 'Después', 'quedan por cobrar'], [false, 'Al terminar', 'ya cobrados']] as const).map(([later, label, sub]) => {
            const active = draft.paysLater === later
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${label}: ${sub}`}
                onClick={() => set({ paysLater: later })}
                className={`rounded-lg py-2 text-center transition-all touch-manipulation ${active ? `bg-white shadow-sm ${later ? 'text-amber-700' : 'text-emerald-700'}` : 'text-[#787774]'}`}
              >
                <span className="block text-[13px] font-semibold">{label}</span>
                <span className="block text-[11px] opacity-80">{sub}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className={labelClass}>Te paga con <span className="font-normal text-[#9b9a97]">(opcional)</span></div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
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

      <Preview draft={draft} />
    </div>
  )
}

function bodyOf(draft: Draft) {
  return {
    name: draft.name,
    color: draft.color,
    payType: draft.payType,
    rate: draft.payType === 'variable' ? null : rateOf(draft),
    paysLater: draft.paysLater,
    paymentMethod: draft.paymentMethod || null,
  }
}

function canSave(draft: Draft): boolean {
  return draft.name.trim().length > 0 && (draft.payType === 'variable' || rateOf(draft) > 0)
}

function ErrorBox({ text }: { readonly text: string }) {
  return <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626] animate-fade-in">{text}</div>
}

// ── Nueva ─────────────────────────────────────────────────────────────────────

function CreateCompany({ onCreated }: { readonly onCreated: (company: PayCompany) => void }) {
  const [draft, setDraft] = useState(() => draftOf())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    const result = await sendJson('/api/payment/companies', 'POST', bodyOf(draft))
    setBusy(false)
    if (!result.ok) setError(result.error ?? 'No se pudo crear')
    else onCreated(result.data as PayCompany)
  }

  return (
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); if (canSave(draft) && !busy) save() }}>
      <CompanyFields draft={draft} onChange={setDraft} autoFocus />
      {error && <ErrorBox text={error} />}
      <button
        type="submit"
        disabled={!canSave(draft) || busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-semibold text-white disabled:opacity-50 touch-manipulation active:scale-[0.99]"
        style={{ backgroundColor: PAY_ACCENT }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {busy ? 'Creando…' : 'Crear compañía'}
      </button>
    </form>
  )
}

// ── Editar ────────────────────────────────────────────────────────────────────

function EditCompany({ company, onChanged, onGone }: {
  readonly company: PayCompany
  readonly onChanged: (message: string) => void
  readonly onGone: () => void
}) {
  const today = getFloridaDateString()
  const [draft, setDraft] = useState(() => draftOf(company))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Cambió lo que paga por día: también se pueden actualizar días ya anotados
  const [applyPast, setApplyPast] = useState(false)
  const [applyFrom, setApplyFrom] = useState(() => getPayPeriod(today, 1).start)

  const rateChanged = draft.payType === 'per_day' && company.payType === 'per_day' && rateOf(draft) > 0 && rateOf(draft) !== company.rate
  const dirty = JSON.stringify(bodyOf(draft)) !== JSON.stringify(bodyOf(draftOf(company)))

  const save = async () => {
    setBusy('save')
    setError(null)
    const result = await sendJson(`/api/payment/companies/${company.id}`, 'PATCH', {
      ...bodyOf(draft),
      applyFrom: rateChanged && applyPast ? applyFrom : undefined,
    })
    setBusy(null)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo guardar')
      return
    }
    const updatedDays = (result.data as { updatedDays: number }).updatedDays
    onChanged(updatedDays > 0 ? `Compañía guardada · ${countLabel(updatedDays, true)} actualizados` : 'Compañía guardada')
    setApplyPast(false)
  }

  const toggleArchived = async () => {
    setBusy('archive')
    setError(null)
    const result = await sendJson(`/api/payment/companies/${company.id}`, 'PATCH', { archived: !company.archived })
    setBusy(null)
    if (!result.ok) setError(result.error ?? 'No se pudo guardar')
    else onChanged(company.archived ? `${company.name} volvió a la lista` : `${company.name} archivada`)
  }

  const remove = async () => {
    setBusy('delete')
    setError(null)
    const result = await sendJson(`/api/payment/companies/${company.id}`, 'DELETE')
    setBusy(null)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo borrar')
      setConfirmDelete(false)
      return
    }
    onChanged(`${company.name} borrada`)
    onGone()
  }

  return (
    <div className="space-y-6">
      {/* Cómo va con esta compañía */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[rgba(55,53,47,0.04)] px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9a97]">Registros</div>
          <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#37352f]">{company.jobCount}</div>
        </div>
        <div className={`rounded-xl px-3 py-2.5 ${company.pending > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
          <div className={`text-[10px] font-semibold uppercase tracking-wide ${company.pending > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>Te debe</div>
          <div className={`mt-0.5 text-[17px] font-bold tabular-nums ${company.pending > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {company.pending > 0 ? formatCurrency(company.pending) : 'Nada'}
          </div>
        </div>
      </div>

      <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (canSave(draft) && dirty && !busy) save() }}>
        <CompanyFields draft={draft} onChange={setDraft} autoFocus={false} />

        {rateChanged && company.jobCount > 0 && (
          <div className="space-y-2 rounded-xl border border-[rgba(55,53,47,0.16)] p-3 animate-fade-in">
            <label className="flex items-start gap-2.5 text-[13px] text-[#37352f] touch-manipulation">
              <input type="checkbox" checked={applyPast} onChange={e => setApplyPast(e.target.checked)} className="mt-0.5 h-4 w-4" style={{ accentColor: PAY_ACCENT }} />
              <span>
                <span className="font-semibold">Actualizar también días ya anotados</span>
                <span className="block text-[12px] text-[#787774]">Si no, los días anteriores conservan {company.rate ? shortMoney(company.rate) : 'su pago'} y el nuevo monto aplica desde hoy.</span>
              </span>
            </label>
            {applyPast && (
              <label className="block pl-6 text-[11px] text-[#787774]">
                Desde
                <input type="date" value={applyFrom} max={today} onChange={e => setApplyFrom(e.target.value || today)} className={inputClass} style={{ fontSize: '16px' }} />
              </label>
            )}
          </div>
        )}

        {error && <ErrorBox text={error} />}
        <button
          type="submit"
          disabled={!canSave(draft) || !dirty || busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-semibold text-white disabled:opacity-50 touch-manipulation active:scale-[0.99]"
          style={{ backgroundColor: PAY_ACCENT }}
        >
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {busy === 'save' ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios'}
        </button>
      </form>

      <section className="space-y-2 border-t border-[rgba(55,53,47,0.09)] pt-4">
        <button
          type="button"
          onClick={toggleArchived}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(55,53,47,0.16)] py-2.5 text-[14px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.04)] disabled:opacity-50 touch-manipulation"
        >
          {company.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          {company.archived ? 'Volver a mostrarla' : 'Archivar (ocultarla sin perder su historial)'}
        </button>
        {company.jobCount === 0 && (confirmDelete ? (
          <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[13px] text-red-800">¿Borrar {company.name}? No tiene trabajos registrados.</p>
            <div className="flex gap-2">
              <button type="button" onClick={remove} disabled={busy !== null} className="flex-1 rounded-lg bg-red-600 py-2.5 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {busy === 'delete' ? 'Borrando…' : 'Sí, borrar'}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-[#787774] hover:bg-white">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50 touch-manipulation"
          >
            <Trash2 className="h-4 w-4" /> Borrar compañía
          </button>
        ))}
      </section>
    </div>
  )
}

// ── Lista ─────────────────────────────────────────────────────────────────────

function CompanyRow({ company, onOpen }: { readonly company: PayCompany; readonly onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[rgba(55,53,47,0.03)] touch-manipulation ${company.archived ? 'opacity-60' : ''}`}>
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[14px] font-bold text-white" style={{ backgroundColor: company.color }}>
        {company.name.trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-[#37352f]">
          {company.name}
          {company.archived && <span className="ml-1.5 text-[11px] font-normal text-[#787774]">(archivada)</span>}
        </div>
        <div className="truncate text-[12px] text-[#787774]">
          {describePay(company)} · {company.paysLater ? 'paga después' : 'paga al terminar'}
        </div>
      </div>
      {company.pending > 0 && (
        <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800">
          Te debe {formatCurrency(company.pending)}
        </span>
      )}
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#9b9a97]" />
    </button>
  )
}

export function PayCompanyManager({ companies, startCreating = false, onClose, onChanged }: PayCompanyManagerProps) {
  const [view, setView] = useState<View>({ mode: startCreating || companies.length === 0 ? 'create' : 'list' })
  const editing = view.mode === 'edit' ? companies.find(c => c.id === view.id) : undefined

  let title = 'Compañías'
  let subtitle = 'Quién te paga y cuánto'
  if (view.mode === 'create') {
    title = 'Nueva compañía'
    subtitle = 'Por día, por trabajo o variable'
  } else if (editing) {
    title = editing.name
    subtitle = describePay(editing)
  }
  const canGoBack = view.mode !== 'list' && companies.length > 0

  return createPortal(
    <dialog open aria-label={title} className="fixed inset-0 z-[9999] m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 sm:items-center">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/50 animate-fade-in-backdrop" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up-modal sm:max-h-[90dvh] sm:rounded-2xl">
        <div className="flex justify-center pt-2 sm:hidden"><span className="h-1 w-10 rounded-full bg-[rgba(55,53,47,0.2)]" /></div>
        <div className="flex items-start gap-2 border-b border-[rgba(55,53,47,0.09)] px-5 pb-3 pt-3 sm:pt-5">
          {canGoBack && (
            <button type="button" onClick={() => setView({ mode: 'list' })} aria-label="Volver" className="-ml-2 rounded-lg p-1.5 text-[#787774] hover:bg-[rgba(55,53,47,0.08)]">
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
          {view.mode === 'list' && (
            <div className="space-y-3">
              <p className="text-[13px] text-[#787774]">
                Guarda las compañías que te pagan. Al elegir una, el pago se anota solo (por día o por trabajo) y en Cobros ves cuánto te debe cada una.
              </p>
              <div className="divide-y divide-[rgba(55,53,47,0.09)] overflow-hidden rounded-xl border border-[rgba(55,53,47,0.09)]">
                {companies.map(company => (
                  <CompanyRow key={company.id} company={company} onOpen={() => setView({ mode: 'edit', id: company.id })} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setView({ mode: 'create' })}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-[14px] font-semibold hover:bg-[rgba(46,117,204,0.05)] touch-manipulation"
                style={{ borderColor: PAY_ACCENT, color: PAY_ACCENT }}
              >
                <Plus className="h-4 w-4" /> Nueva compañía
              </button>
            </div>
          )}
          {view.mode === 'create' && (
            <>
              {companies.length === 0 && (
                <div className="mb-5 flex items-start gap-3 rounded-xl bg-[rgba(46,117,204,0.07)] px-3 py-3 text-[12px] leading-relaxed text-[#37352f]">
                  <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: PAY_ACCENT }} />
                  <span>¿Una empresa te paga un monto fijo por día o por trabajo? Guárdala y la app anota el pago sola, te dice cuánto te sale por hora y cuánto te debe.</span>
                </div>
              )}
              <CreateCompany
                onCreated={company => {
                  onChanged(`${company.name} agregada`, company)
                  onClose()
                }}
              />
            </>
          )}
          {view.mode === 'edit' && editing && (
            <EditCompany key={editing.id} company={editing} onChanged={message => onChanged(message)} onGone={() => setView({ mode: 'list' })} />
          )}
        </div>
      </div>
    </dialog>,
    document.body
  )
}
