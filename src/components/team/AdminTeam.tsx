'use client'

import { useState } from 'react'
import { Check, Copy, RefreshCw, Share2, ShieldCheck, UserCheck, UserX } from 'lucide-react'
import type { MemberInfo } from '@/lib/org-shared'
import { ErrorBox, Pill, api, cardClass, inputClass } from './ui'

interface Props {
  readonly orgId: string
  readonly orgName: string
  readonly joinCode: string
  readonly members: MemberInfo[]
  readonly onChanged: (message: string) => void
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'
}

function MemberRow({ orgId, member, onChanged }: { readonly orgId: string; readonly member: MemberInfo; readonly onChanged: (message: string) => void }) {
  const [rate, setRate] = useState(member.hourlyRate ? String(member.hourlyRate) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = async (body: Record<string, unknown>, message: string) => {
    setBusy(true)
    setError(null)
    const result = await api(`/api/org/${orgId}/admin/members/${member.id}`, 'PATCH', body)
    setBusy(false)
    if (result.error) setError(result.error)
    else onChanged(message)
  }

  const reject = async () => {
    setBusy(true)
    const result = await api(`/api/org/${orgId}/admin/members/${member.id}`, 'DELETE')
    setBusy(false)
    if (result.error) setError(result.error)
    else onChanged(`Solicitud de ${member.name} rechazada`)
  }

  const rateChanged = rate !== '' && Number(rate) !== member.hourlyRate
  const smallButton = 'rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50 touch-manipulation'

  return (
    <div className={`rounded-xl border p-3 ${member.status === 'pending' ? 'border-amber-200 bg-amber-50/60' : 'border-[rgba(55,53,47,0.12)] bg-white'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${member.status === 'active' ? 'bg-[#37352f] text-white' : 'bg-[rgba(55,53,47,0.1)] text-[#787774]'}`}>
          {initials(member.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-[#37352f]">
            {member.name}
            {member.role === 'admin' && <Pill tone="blue"><ShieldCheck className="h-2.5 w-2.5" />admin</Pill>}
            {member.status === 'pending' && <Pill tone="amber">pide unirse</Pill>}
            {member.status === 'inactive' && <Pill tone="gray">inactivo</Pill>}
          </div>
          <div className="truncate text-[12px] text-[#787774]">{member.email}</div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <label className="block w-28 text-[11px] text-[#787774]">
          Tarifa ($/h)
          <input type="number" inputMode="decimal" min="0" step="0.25" value={rate} onChange={e => setRate(e.target.value)} placeholder="0.00" className={`${inputClass} py-1.5`} style={{ fontSize: '16px' }} />
        </label>
        {member.status === 'pending' ? (
          <>
            <button type="button" onClick={() => patch({ status: 'active', hourlyRate: rate || 0 }, `${member.name} aprobado`)} disabled={busy} className={`${smallButton} flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700`}>
              <UserCheck className="h-3.5 w-3.5" />Aprobar
            </button>
            <button type="button" onClick={reject} disabled={busy} className={`${smallButton} text-[#787774] hover:bg-[rgba(55,53,47,0.06)]`}>Rechazar</button>
          </>
        ) : (
          <>
            {rateChanged && (
              <button type="button" onClick={() => patch({ hourlyRate: rate }, `Tarifa de ${member.name} guardada`)} disabled={busy} className={`${smallButton} flex items-center gap-1 bg-[#37352f] text-white`}>
                <Check className="h-3.5 w-3.5" />Guardar
              </button>
            )}
            {member.status === 'active' ? (
              <button type="button" onClick={() => patch({ status: 'inactive' }, `${member.name} desactivado`)} disabled={busy} className={`${smallButton} flex items-center gap-1 text-[#787774] hover:bg-[rgba(55,53,47,0.06)]`}>
                <UserX className="h-3.5 w-3.5" />Desactivar
              </button>
            ) : (
              <button type="button" onClick={() => patch({ status: 'active' }, `${member.name} reactivado`)} disabled={busy} className={`${smallButton} text-emerald-700 hover:bg-emerald-50`}>Reactivar</button>
            )}
            {member.status === 'active' && (
              <button
                type="button"
                onClick={() => patch({ role: member.role === 'admin' ? 'employee' : 'admin' }, member.role === 'admin' ? `${member.name} ya no es administrador` : `${member.name} ahora es administrador`)}
                disabled={busy}
                className={`${smallButton} text-[#787774] hover:bg-[rgba(55,53,47,0.06)]`}
              >
                {member.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
              </button>
            )}
          </>
        )}
      </div>
      {error && <div className="mt-2"><ErrorBox>{error}</ErrorBox></div>}
    </div>
  )
}

export function AdminTeam({ orgId, orgName, joinCode, members, onChanged }: Props) {
  const [copied, setCopied] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/team?join=${joinCode}`
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar; copia el código a mano')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: `Únete a ${orgName}`, text: `Únete a ${orgName} en Meditron para marcar tu entrada y salida. Código: ${joinCode}`, url: link })
    } catch { /* cancelado */ }
  }

  const regenerate = async () => {
    const result = await api(`/api/org/${orgId}/admin`, 'PATCH', { regenerateCode: true })
    setConfirmNew(false)
    if (result.error) setError(result.error)
    else onChanged('Código nuevo creado: el anterior ya no sirve')
  }

  const pending = members.filter(m => m.status === 'pending')
  const others = members.filter(m => m.status !== 'pending')

  return (
    <div className="space-y-3">
      <section className={cardClass}>
        <div className="text-[14px] font-semibold text-[#37352f]">Invitar empleados</div>
        <p className="mt-0.5 text-[12px] text-[#787774]">Cada empleado crea su cuenta, entra a «Empresa» y escribe este código (o abre el enlace). Tú lo apruebas aquí.</p>
        <div className="mt-3 rounded-xl bg-[rgba(55,53,47,0.05)] py-3 text-center font-mono text-[28px] font-bold tracking-[0.25em] text-[#37352f]">{joinCode}</div>
        <div className={`mt-3 grid gap-2 ${canShare ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <button type="button" onClick={copy} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#37352f] py-2.5 text-[13px] font-semibold text-white">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copiado' : 'Copiar enlace'}
          </button>
          {canShare && (
            <button type="button" onClick={share} className="flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(55,53,47,0.16)] py-2.5 text-[13px] font-semibold text-[#37352f]">
              <Share2 className="h-4 w-4" />Compartir
            </button>
          )}
          <button type="button" onClick={() => setConfirmNew(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(55,53,47,0.16)] py-2.5 text-[13px] font-semibold text-[#37352f]">
            <RefreshCw className="h-4 w-4" />Código nuevo
          </button>
        </div>
        {confirmNew && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900 animate-fade-in">
            <span>El código actual dejará de funcionar. ¿Continuar?</span>
            <span className="flex gap-1">
              <button type="button" onClick={() => setConfirmNew(false)} className="rounded-md px-2 py-1 font-semibold">No</button>
              <button type="button" onClick={regenerate} className="rounded-md bg-amber-600 px-2 py-1 font-semibold text-white">Sí</button>
            </span>
          </div>
        )}
        {error && <div className="mt-2"><ErrorBox>{error}</ErrorBox></div>}
      </section>

      {pending.length > 0 && (
        <section className="space-y-2">
          <div className="px-1 text-[12px] font-semibold uppercase tracking-wide text-[#787774]">Quieren unirse</div>
          {pending.map(m => <MemberRow key={m.id} orgId={orgId} member={m} onChanged={onChanged} />)}
        </section>
      )}
      <section className="space-y-2">
        <div className="px-1 text-[12px] font-semibold uppercase tracking-wide text-[#787774]">Equipo ({others.length})</div>
        {others.map(m => <MemberRow key={`${m.id}:${m.hourlyRate}:${m.status}:${m.role}`} orgId={orgId} member={m} onChanged={onChanged} />)}
      </section>
    </div>
  )
}
