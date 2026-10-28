'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Building2, Hourglass, KeyRound, Loader2, ShieldCheck, UserX } from 'lucide-react'
import { DAY_NAMES } from '@/lib/companies'
import type { OrgMembership } from '@/lib/org-shared'
import { AdminPanel } from '@/components/team/AdminPanel'
import { EmployeeClock } from '@/components/team/EmployeeClock'
import { OfficeFields } from '@/components/team/AdminSettings'
import { ErrorBox, api, cardClass, inputClass, labelClass, primaryButton } from '@/components/team/ui'

const ORG_STORAGE_KEY = 'meditron_team_org'
/** Código de invitación abierto antes de iniciar sesión: se usa al volver */
const PENDING_JOIN_KEY = 'meditron_pending_join'

function JoinCard({ initialCode, onJoined }: { readonly initialCode: string; readonly onJoined: () => void }) {
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const join = async () => {
    setBusy(true)
    setError(null)
    const result = await api('/api/org/join', 'POST', { code })
    setBusy(false)
    if (result.error) setError(result.error)
    else onJoined()
  }

  return (
    <section className={`${cardClass} space-y-3`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><KeyRound className="h-5 w-5" /></span>
        <div>
          <div className="text-[15px] font-semibold text-[#37352f]">Soy empleado</div>
          <div className="text-[12px] text-[#787774]">Escribe el código que te dio tu empresa</div>
        </div>
      </div>
      <input
        type="text"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        maxLength={12}
        autoCapitalize="characters"
        placeholder="Ej: K7M2Q9XA"
        className={`${inputClass} text-center font-mono text-[20px] tracking-[0.2em]`}
      />
      <ErrorBox>{error}</ErrorBox>
      <button type="button" onClick={join} disabled={busy || code.replaceAll(/[^A-Z0-9]/gi, '').length !== 8} className={`${primaryButton} w-full`}>
        {busy ? 'Enviando...' : 'Pedir unirme'}
      </button>
    </section>
  )
}

function CreateCard({ onCreated }: { readonly onCreated: (orgId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [weekStartsOn, setWeekStartsOn] = useState(1)
  const [address, setAddress] = useState('')
  const [point, setPoint] = useState<{ latitude: number; longitude: number; label: string } | null>(null)
  const [radius, setRadius] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    setBusy(true)
    setError(null)
    const result = await api<OrgMembership>('/api/org', 'POST', {
      name, weekStartsOn, address, radiusMiles: radius,
      ...(point ? { latitude: point.latitude, longitude: point.longitude } : {}),
    })
    setBusy(false)
    if (result.data) onCreated(result.data.org.id)
    else setError(result.error)
  }

  return (
    <section className={`${cardClass} space-y-3`}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(55,53,47,0.06)] text-[#37352f]"><ShieldCheck className="h-5 w-5" /></span>
        <span>
          <span className="block text-[15px] font-semibold text-[#37352f]">Soy administrador</span>
          <span className="block text-[12px] text-[#787774]">Crea tu empresa y controla la entrada y salida de tus empleados</span>
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-[rgba(55,53,47,0.09)] pt-3 animate-fade-in">
          <label className={labelClass}>
            Nombre de la empresa
            <input type="text" value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="Ej: Transportes ABC" className={inputClass} style={{ fontSize: '16px' }} />
          </label>
          <label className={labelClass}>
            La semana de pago empieza el
            <select value={weekStartsOn} onChange={e => setWeekStartsOn(Number(e.target.value))} className={inputClass} style={{ fontSize: '16px' }}>
              {DAY_NAMES.map((day, i) => <option key={day} value={i}>{day}</option>)}
            </select>
          </label>
          <OfficeFields address={address} onAddress={setAddress} point={point} onPoint={setPoint} radius={radius} onRadius={setRadius} />
          <ErrorBox>{error}</ErrorBox>
          <button type="button" onClick={create} disabled={busy || name.trim().length < 2 || (!point && address.trim().length < 5)} className={`${primaryButton} w-full`}>
            {busy ? 'Creando...' : 'Crear empresa'}
          </button>
        </div>
      )}
    </section>
  )
}

export default function TeamPage() {
  const router = useRouter()
  const { status } = useSession()
  const [version, setVersion] = useState(0)
  const [memberships, setMemberships] = useState<OrgMembership[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [joinCode] = useState(() => {
    if (typeof window === 'undefined') return ''
    const fromUrl = new URLSearchParams(window.location.search).get('join')?.toUpperCase()
    try { return fromUrl ?? localStorage.getItem(PENDING_JOIN_KEY) ?? '' } catch { return fromUrl ?? '' }
  })
  const [showJoin, setShowJoin] = useState(false)

  useEffect(() => {
    if (status !== 'unauthenticated') return
    // Sin sesión: se guarda la invitación para después de entrar o registrarse
    try { if (joinCode) localStorage.setItem(PENDING_JOIN_KEY, joinCode) } catch { /* sin almacenamiento */ }
    router.push('/login')
  }, [status, router, joinCode])

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    api<OrgMembership[]>('/api/org').then(result => {
      if (cancelled) return
      if (result.data) {
        setMemberships(result.data)
        let saved: string | null = null
        try { saved = localStorage.getItem(ORG_STORAGE_KEY) } catch { /* sin almacenamiento */ }
        setSelected(current => current ?? (result.data!.some(m => m.org.id === saved) ? saved : result.data![0]?.org.id ?? null))
      } else setError(result.error)
    })
    return () => { cancelled = true }
  }, [status, version])

  const choose = (orgId: string) => {
    setSelected(orgId)
    try { localStorage.setItem(ORG_STORAGE_KEY, orgId) } catch { /* sin almacenamiento */ }
  }

  const membership = memberships?.find(m => m.org.id === selected) ?? null
  const reload = () => setVersion(v => v + 1)

  return (
    <div className="min-h-[100dvh] bg-[#fbfbfa] font-notion">
      <header className="sticky top-0 z-20 border-b border-[rgba(55,53,47,0.07)] bg-[#fbfbfa]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <button type="button" onClick={() => router.push('/mode-select')} aria-label="Volver al inicio" className="-ml-1.5 flex items-center gap-2 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-[rgba(55,53,47,0.08)]">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-[#37352f]"><Building2 className="h-3.5 w-3.5 text-white" /></span>
            <span className="text-[14px] font-semibold text-[#37352f]">Empresa</span>
          </button>
          {memberships && memberships.length > 1 && (
            <select value={selected ?? ''} onChange={e => choose(e.target.value)} aria-label="Elegir empresa" className="max-w-[55%] rounded-lg border border-[rgba(55,53,47,0.16)] bg-white px-2 py-1.5 text-[13px] font-semibold text-[#37352f]">
              {memberships.map(m => <option key={m.org.id} value={m.org.id}>{m.org.name}{m.role === 'admin' ? ' (admin)' : ''}</option>)}
            </select>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16 pt-6">
        {error && <ErrorBox>{error}</ErrorBox>}
        {!memberships && !error && <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#787774]" /></div>}

        {memberships && memberships.length === 0 && (
          <>
            <div className="px-1">
              <h1 className="text-[24px] font-bold tracking-tight text-[#37352f]">Control de entrada y salida</h1>
              <p className="mt-1 text-[14px] text-[#787774]">Los empleados marcan desde su teléfono en la oficina; el administrador ve y aprueba las horas.</p>
            </div>
            <JoinCard initialCode={joinCode} onJoined={() => { try { localStorage.removeItem(PENDING_JOIN_KEY) } catch { /* sin almacenamiento */ } reload() }} />
            <CreateCard onCreated={orgId => { choose(orgId); reload() }} />
          </>
        )}

        {membership && (
          <>
            <div className="px-1">
              <h1 className="text-[22px] font-bold tracking-tight text-[#37352f]">{membership.org.name}</h1>
              <p className="text-[13px] text-[#787774]">{membership.role === 'admin' ? 'Eres administrador' : 'Empleado'}</p>
            </div>

            {membership.status === 'pending' && (
              <section className={`${cardClass} flex items-start gap-3`}>
                <Hourglass className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                <div>
                  <div className="text-[15px] font-semibold text-[#37352f]">Solicitud enviada</div>
                  <p className="text-[13px] text-[#787774]">El administrador de {membership.org.name} debe aprobarte. Cuando lo haga podrás marcar tu entrada aquí.</p>
                  <button type="button" onClick={reload} className="mt-2 text-[13px] font-semibold text-[#37352f] underline underline-offset-2">Revisar de nuevo</button>
                </div>
              </section>
            )}
            {membership.status === 'inactive' && (
              <section className={`${cardClass} flex items-start gap-3`}>
                <UserX className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#787774]" />
                <div>
                  <div className="text-[15px] font-semibold text-[#37352f]">Acceso desactivado</div>
                  <p className="text-[13px] text-[#787774]">Habla con el administrador de {membership.org.name} si crees que es un error.</p>
                </div>
              </section>
            )}
            {membership.status === 'active' && membership.role === 'admin' && <AdminPanel key={membership.org.id} membership={membership} />}
            {membership.status === 'active' && membership.role === 'employee' && <EmployeeClock key={membership.org.id} membership={membership} />}

            <div className="pt-2">
              {showJoin ? (
                <JoinCard initialCode="" onJoined={() => { setShowJoin(false); reload() }} />
              ) : (
                <button type="button" onClick={() => setShowJoin(true)} className="w-full py-2 text-center text-[13px] font-semibold text-[#787774] hover:text-[#37352f]">
                  ¿Trabajas en otra empresa? Únete con su código
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
