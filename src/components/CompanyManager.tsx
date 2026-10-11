'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, ChevronRight, ArrowLeft, Archive, ArchiveRestore, Trash2, Check } from 'lucide-react'
import {
  COMPANY_COLORS, DAY_NAMES, FIRST_RULE_DATE, PAY_TYPES,
  describeRule, getPayPeriod, ruleFor, weekShortLabel,
  type Company, type PayRule, type PayType,
} from '@/lib/companies'
import { getFloridaDateString } from '@/lib/utils'
import { formatKeyLong } from '@/lib/report-format'
import { refreshCompanies } from '@/hooks/useCompanies'

interface CompanyManagerProps {
  readonly companies: Company[]
  readonly onClose: () => void
  /** Se llama después de crear o modificar una compañía */
  readonly onChanged: () => void
  /** Abre directamente el formulario de nueva compañía */
  readonly startCreating?: boolean
}

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; id: string }

const inputClass = 'mt-0.5 w-full px-3 py-2 text-[14px] border border-[rgba(55,53,47,0.16)] rounded-lg bg-white text-[#37352f] focus:outline-none focus:border-[#37352f]'
const sectionTitle = 'text-[11px] font-semibold uppercase tracking-wide text-[#787774]'

async function sendJson(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json()
    return data.success ? null : data.error || 'No se pudo guardar'
  } catch {
    return 'Error de conexión'
  }
}

// ── Esquema de pago (tipo, tarifa y overtime) ─────────────────────────────────

interface RuleDraft {
  payType: PayType
  hourlyRate: string
  overtimeAfterHours: string
  overtimeMultiplier: string
}

function draftFromRule(rule?: PayRule): RuleDraft {
  return {
    payType: rule?.payType ?? 'hourly',
    hourlyRate: rule ? String(rule.hourlyRate) : '',
    overtimeAfterHours: rule?.overtimeAfterHours == null ? '' : String(rule.overtimeAfterHours),
    overtimeMultiplier: rule?.overtimeMultiplier == null ? '1.5' : String(rule.overtimeMultiplier),
  }
}

function RuleFields({ draft, onChange }: { readonly draft: RuleDraft; readonly onChange: (draft: RuleDraft) => void }) {
  const set = (patch: Partial<RuleDraft>) => onChange({ ...draft, ...patch })
  const hasOvertime = draft.payType !== 'hourly'
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {PAY_TYPES.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => set({
              payType: option.value,
              // Valores habituales al elegir overtime: 40 h/semana u 8 h/día
              overtimeAfterHours: option.value === 'hourly' ? draft.overtimeAfterHours
                : draft.overtimeAfterHours || (option.value === 'daily_overtime' ? '8' : '40'),
            })}
            className={`w-full text-left rounded-lg border px-3 py-2 transition-colors touch-manipulation ${draft.payType === option.value ? 'border-[#37352f] bg-[rgba(55,53,47,0.04)]' : 'border-[rgba(55,53,47,0.16)] hover:bg-[rgba(55,53,47,0.03)]'}`}
          >
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#37352f]">
              <span className={`h-3.5 w-3.5 rounded-full border-2 ${draft.payType === option.value ? 'border-[#37352f] bg-[#37352f]' : 'border-[#c4c3c0]'}`} />
              {option.label}
            </div>
            <div className="pl-[22px] text-[12px] text-[#787774]">{option.help}</div>
          </button>
        ))}
      </div>
      <div className={`grid gap-2 ${hasOvertime ? 'grid-cols-3' : 'grid-cols-1'}`}>
        <label className="block text-[11px] text-[#787774]">
          Tarifa ($/hora)
          <input type="number" inputMode="decimal" step="0.01" min="0" value={draft.hourlyRate} onChange={e => set({ hourlyRate: e.target.value })} className={inputClass} style={{ fontSize: '16px' }} />
        </label>
        {hasOvertime && (
          <>
            <label className="block text-[11px] text-[#787774]">
              Overtime después de (h/{draft.payType === 'daily_overtime' ? 'día' : 'semana'})
              <input type="number" inputMode="decimal" step="0.5" min="0" value={draft.overtimeAfterHours} onChange={e => set({ overtimeAfterHours: e.target.value })} className={inputClass} style={{ fontSize: '16px' }} />
            </label>
            <label className="block text-[11px] text-[#787774]">
              Multiplicador
              <input type="number" inputMode="decimal" step="0.25" min="1" value={draft.overtimeMultiplier} onChange={e => set({ overtimeMultiplier: e.target.value })} className={inputClass} style={{ fontSize: '16px' }} />
            </label>
          </>
        )}
      </div>
    </div>
  )
}

// ── Datos de la compañía ──────────────────────────────────────────────────────

interface DetailsDraft {
  name: string
  color: string
  weekStartsOn: number
  trackJobNumber: boolean
  trackVehicle: boolean
  trackServiceType: boolean
  trackCompanyPaid: boolean
  /** Correos del reporte semanal, separados por coma */
  reportEmails: string
}

const TRACK_OPTIONS: { key: keyof Pick<DetailsDraft, 'trackJobNumber' | 'trackVehicle' | 'trackServiceType' | 'trackCompanyPaid'>; label: string }[] = [
  { key: 'trackJobNumber', label: 'Número de trabajo' },
  { key: 'trackVehicle', label: 'Vehículo' },
  { key: 'trackServiceType', label: 'Tipo de servicio (Hourly / P2P)' },
  { key: 'trackCompanyPaid', label: 'Lo que pagó la empresa (para comparar)' },
]

function draftFromCompany(company?: Company): DetailsDraft {
  return {
    name: company?.name ?? '',
    color: company?.color ?? COMPANY_COLORS[1],
    weekStartsOn: company?.weekStartsOn ?? 1,
    trackJobNumber: company?.trackJobNumber ?? false,
    trackVehicle: company?.trackVehicle ?? false,
    trackServiceType: company?.trackServiceType ?? false,
    trackCompanyPaid: company?.trackCompanyPaid ?? false,
    reportEmails: company?.reportEmails.join(', ') ?? '',
  }
}

function DetailsFields({ draft, onChange }: { readonly draft: DetailsDraft; readonly onChange: (draft: DetailsDraft) => void }) {
  const set = (patch: Partial<DetailsDraft>) => onChange({ ...draft, ...patch })
  return (
    <div className="space-y-3">
      <label className="block text-[11px] text-[#787774]">
        Nombre
        <input type="text" value={draft.name} maxLength={60} onChange={e => set({ name: e.target.value })} placeholder="Ej: Transportes ABC" className={inputClass} style={{ fontSize: '16px' }} />
      </label>
      <div>
        <div className="text-[11px] text-[#787774] mb-1">Color</div>
        <div className="flex gap-2 flex-wrap">
          {COMPANY_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => set({ color })}
              aria-label={`Color ${color}`}
              className="h-8 w-8 rounded-full flex items-center justify-center touch-manipulation ring-offset-2"
              style={{ backgroundColor: color, boxShadow: draft.color === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined }}
            >
              {draft.color === color && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-[11px] text-[#787774]">
        La semana de pago empieza el
        <select value={draft.weekStartsOn} onChange={e => set({ weekStartsOn: Number(e.target.value) })} className={inputClass} style={{ fontSize: '16px' }}>
          {DAY_NAMES.map((day, index) => (
            <option key={day} value={index}>{day} ({weekShortLabel(index)})</option>
          ))}
        </select>
      </label>
      <div>
        <div className="text-[11px] text-[#787774] mb-1">Qué registras en cada trabajo (además de las horas)</div>
        <div className="space-y-1">
          {TRACK_OPTIONS.map(option => (
            <label key={option.key} className="flex items-center gap-2 py-1 text-[14px] text-[#37352f] touch-manipulation">
              <input type="checkbox" checked={draft[option.key]} onChange={e => set({ [option.key]: e.target.checked })} className="h-4 w-4 accent-[#37352f]" />
              {option.label}
            </label>
          ))}
        </div>
      </div>
      <label className="block text-[11px] text-[#787774]">
        Correos para el reporte semanal (opcional)
        <input
          type="text"
          inputMode="email"
          value={draft.reportEmails}
          onChange={e => set({ reportEmails: e.target.value })}
          placeholder="nomina@empresa.com, jefe@empresa.com"
          className={inputClass}
          style={{ fontSize: '16px' }}
        />
        <span className="mt-1 block text-[11px] text-[#9b9a97]">A estos correos se envía el PDF de cada semana con un toque. Sepáralos con comas.</span>
      </label>
    </div>
  )
}

// ── Crear ─────────────────────────────────────────────────────────────────────

function CreateCompany({ onDone }: { readonly onDone: (error: string | null) => void }) {
  const [details, setDetails] = useState(() => draftFromCompany())
  const [rule, setRule] = useState(() => draftFromRule())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const result = await sendJson('/api/companies', 'POST', { ...details, rule })
    setSaving(false)
    if (result) setError(result)
    else onDone(null)
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className={sectionTitle}>Datos</div>
        <DetailsFields draft={details} onChange={setDetails} />
      </section>
      <section className="space-y-2">
        <div className={sectionTitle}>Cómo te pagan</div>
        <RuleFields draft={rule} onChange={setRule} />
      </section>
      {error && <div className="text-[13px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] py-2 px-3 rounded-lg">{error}</div>}
      <button type="button" onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl bg-[#37352f] text-white text-[14px] font-semibold disabled:opacity-50 touch-manipulation">
        {saving ? 'Creando...' : 'Crear compañía'}
      </button>
    </div>
  )
}

// ── Editar ────────────────────────────────────────────────────────────────────

function EditCompany({ company, onChanged, onDeleted }: { readonly company: Company; readonly onChanged: () => void; readonly onDeleted: () => void }) {
  const today = getFloridaDateString()
  const currentRule = ruleFor(company, today)
  const [details, setDetails] = useState(() => draftFromCompany(company))
  const [rule, setRule] = useState(() => draftFromRule(currentRule))
  const [effectiveFrom, setEffectiveFrom] = useState(() => getPayPeriod(today, company.weekStartsOn).start)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)

  const run = async (label: string, action: () => Promise<string | null>, success: string) => {
    setBusy(label)
    setMessage(null)
    const error = await action()
    setBusy(null)
    setMessage(error ? { error: true, text: error } : { error: false, text: success })
    if (!error) onChanged()
    return error
  }

  const saveDetails = () => run('details', () => sendJson(`/api/companies/${company.id}`, 'PATCH', details), 'Datos guardados')
  const saveRule = () => run('rule', () => sendJson(`/api/companies/${company.id}/rules`, 'PUT', { ...rule, effectiveFrom }), 'Esquema de pago guardado y trabajos recalculados')
  const deleteRule = (ruleId: string) => run('rule', () => sendJson(`/api/companies/${company.id}/rules?ruleId=${ruleId}`, 'DELETE'), 'Versión eliminada y trabajos recalculados')
  const toggleArchived = () => run('archive', () => sendJson(`/api/companies/${company.id}`, 'PATCH', { archived: !company.archived }), company.archived ? 'Compañía restaurada' : 'Compañía archivada')
  const deleteCompany = async () => {
    const error = await run('delete', () => sendJson(`/api/companies/${company.id}`, 'DELETE'), 'Compañía borrada')
    if (!error) onDeleted()
  }

  const rules = [...company.payRules].reverse()

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className={sectionTitle}>Datos</div>
        <DetailsFields draft={details} onChange={setDetails} />
        <button type="button" onClick={saveDetails} disabled={busy !== null} className="w-full py-2.5 rounded-xl bg-[#37352f] text-white text-[14px] font-semibold disabled:opacity-50 touch-manipulation">
          {busy === 'details' ? 'Guardando...' : 'Guardar datos'}
        </button>
      </section>

      <section className="space-y-2">
        <div className={sectionTitle}>Esquema de pago</div>
        <div className="rounded-lg border border-[rgba(55,53,47,0.09)] divide-y divide-[rgba(55,53,47,0.09)]">
          {rules.map(r => (
            <div key={r.id ?? r.effectiveFrom} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[#37352f]">{describeRule(r)}</div>
                <div className="text-[11px] text-[#787774]">
                  {r.effectiveFrom === FIRST_RULE_DATE ? 'Desde el inicio' : `Desde ${formatKeyLong(r.effectiveFrom)}`}
                  {r === currentRule && ' · vigente'}
                </div>
              </div>
              {r.id && company.payRules.length > 1 && (
                <button type="button" onClick={() => deleteRule(r.id!)} disabled={busy !== null} aria-label="Eliminar versión" className="p-1.5 rounded-md text-[#787774] hover:text-[#dc2626] hover:bg-[#fef2f2] touch-manipulation">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-[#37352f] p-3 space-y-3">
          <div className="text-[13px] font-semibold text-[#37352f]">Cambiar tarifa o esquema</div>
          <RuleFields draft={rule} onChange={setRule} />
          <label className="block text-[11px] text-[#787774]">
            Aplica desde
            <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
          </label>
          <p className="text-[11px] text-[#787774]">
            Los trabajos desde esa fecha se recalculan; las semanas anteriores conservan su tarifa. Si eliges una fecha que ya tiene versión, se reemplaza.
          </p>
          <button type="button" onClick={saveRule} disabled={busy !== null || !effectiveFrom} className="w-full py-2.5 rounded-xl bg-[#37352f] text-white text-[14px] font-semibold disabled:opacity-50 touch-manipulation">
            {busy === 'rule' ? 'Guardando...' : 'Guardar esquema de pago'}
          </button>
        </div>
      </section>

      {message && (
        <div className={`text-[13px] py-2 px-3 rounded-lg border ${message.error ? 'text-[#dc2626] bg-[#fef2f2] border-[#fecaca]' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
          {message.text}
        </div>
      )}

      <section className="space-y-2 border-t border-[rgba(55,53,47,0.09)] pt-4">
        <button type="button" onClick={toggleArchived} disabled={busy !== null} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[rgba(55,53,47,0.16)] text-[14px] font-semibold text-[#37352f] disabled:opacity-50 touch-manipulation">
          {company.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          {company.archived ? 'Restaurar compañía' : 'Archivar (ocultarla sin perder su historial)'}
        </button>
        <button type="button" onClick={deleteCompany} disabled={busy !== null} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50 touch-manipulation">
          <Trash2 className="h-4 w-4" />
          Borrar (solo si no tiene trabajos)
        </button>
      </section>
    </div>
  )
}

// ── Lista ─────────────────────────────────────────────────────────────────────

function CompanyRow({ company, onOpen }: { readonly company: Company; readonly onOpen: () => void }) {
  const today = getFloridaDateString()
  return (
    <button type="button" onClick={onOpen} className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-[rgba(55,53,47,0.03)] touch-manipulation ${company.archived ? 'opacity-60' : ''}`}>
      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: company.color }} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-[#37352f] truncate">
          {company.name}
          {company.archived && <span className="ml-1.5 text-[11px] font-normal text-[#787774]">(archivada)</span>}
        </div>
        <div className="text-[12px] text-[#787774] truncate">
          {weekShortLabel(company.weekStartsOn)} · {describeRule(ruleFor(company, today))}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-[#787774] flex-shrink-0" />
    </button>
  )
}

/** Hoja para ver, crear y configurar las compañías del usuario. */
export function CompanyManager({ companies, onClose, onChanged, startCreating = false }: CompanyManagerProps) {
  const [view, setView] = useState<View>({ mode: startCreating ? 'create' : 'list' })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Montaje en el cliente para poder usar el portal
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const afterChange = async () => {
    await refreshCompanies()
    onChanged()
  }

  if (!mounted) return null

  const editing = view.mode === 'edit' ? companies.find(c => c.id === view.id) : undefined
  let title = 'Compañías'
  if (view.mode === 'create') title = 'Nueva compañía'
  else if (editing) title = editing.name

  return createPortal(
    <dialog open aria-label="Compañías" className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center w-full h-full max-w-none max-h-none m-0 p-0 bg-transparent border-0">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88dvh]">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[rgba(55,53,47,0.09)]">
          {view.mode !== 'list' && (
            <button type="button" onClick={() => setView({ mode: 'list' })} aria-label="Volver" className="p-1.5 rounded-lg text-[#787774] hover:bg-[rgba(55,53,47,0.08)]">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="flex-1 text-[16px] font-bold text-[#37352f] truncate">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl bg-[rgba(55,53,47,0.06)] text-[#787774] hover:bg-[rgba(55,53,47,0.12)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {view.mode === 'list' && (
            <div className="space-y-3">
              <p className="text-[13px] text-[#787774]">
                Cada compañía tiene su semana de pago, su tarifa (con overtime si aplica) y los datos que registras en cada trabajo.
              </p>
              <div className="rounded-xl border border-[rgba(55,53,47,0.09)] divide-y divide-[rgba(55,53,47,0.09)] overflow-hidden">
                {companies.map(company => (
                  <CompanyRow key={company.id} company={company} onOpen={() => setView({ mode: 'edit', id: company.id })} />
                ))}
              </div>
              <button type="button" onClick={() => setView({ mode: 'create' })} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#37352f] text-[14px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.04)] touch-manipulation">
                <Plus className="h-4 w-4" />
                Nueva compañía
              </button>
            </div>
          )}
          {view.mode === 'create' && (
            <CreateCompany onDone={async () => { await afterChange(); setView({ mode: 'list' }) }} />
          )}
          {view.mode === 'edit' && editing && (
            <EditCompany key={editing.id} company={editing} onChanged={afterChange} onDeleted={() => setView({ mode: 'list' })} />
          )}
        </div>
      </div>
    </dialog>,
    document.body
  )
}
