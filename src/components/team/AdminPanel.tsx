'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, Check, Clock, Inbox, Loader2, Settings, Users } from 'lucide-react'
import { formatDistance } from '@/lib/geo'
import { formatKeyShort, formatTime12 } from '@/lib/report-format'
import { FORGOTTEN_SHIFT_HOURS, type MemberInfo, type OrgMembership, type OrgSettings, type OrgShiftInfo } from '@/lib/org-shared'
import { AdminHours } from './AdminHours'
import { AdminSettings } from './AdminSettings'
import { AdminTeam } from './AdminTeam'
import { EmployeeClock } from './EmployeeClock'
import { ShiftSheet, type ShiftSheetMode } from './ShiftSheet'
import { ErrorBox, Pill, api, cardClass, hm } from './ui'

type PersonNow = MemberInfo & { openShift: OrgShiftInfo | null; todaySeconds: number; todayShifts: number; weekSeconds: number }

interface Overview {
  serverTime: string
  org: OrgSettings
  joinCode: string
  week: { start: string; end: string }
  members: PersonNow[]
  corrections: OrgShiftInfo[]
}

type Tab = 'now' | 'hours' | 'requests' | 'team' | 'settings' | 'me'

function Stat({ label, value, tone = 'text-[#37352f]' }: { readonly label: string; readonly value: string; readonly tone?: string }) {
  return (
    <div className="px-2 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">{label}</div>
      <div className={`text-[18px] font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}

export function AdminPanel({ membership }: { readonly membership: OrgMembership }) {
  const orgId = membership.org.id
  const [tab, setTab] = useState<Tab>('now')
  const [version, setVersion] = useState(0)
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<ShiftSheetMode | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<Overview>(`/api/org/${orgId}/admin`).then(result => {
      if (cancelled) return
      if (result.data) {
        setData(result.data)
        setError(null)
        setNow(new Date(result.data.serverTime).getTime())
      } else setError(result.error)
    })
    return () => { cancelled = true }
  }, [orgId, version])

  // Se actualiza solo cada minuto para ver quién entra y sale
  useEffect(() => {
    const id = setInterval(() => setVersion(v => v + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast])

  const changed = useCallback((message: string) => {
    setToast(message)
    setVersion(v => v + 1)
  }, [])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#787774]" /></div>

  // Los administradores que no marcan no cuentan como equipo de hoy
  const active = data.members.filter(m => m.status === 'active' && (m.role === 'employee' || m.openShift || m.weekSeconds > 0 || m.todayShifts > 0))
  const pendingMembers = data.members.filter(m => m.status === 'pending')
  const working = active.filter(m => m.openShift)
  const forgotten = working.filter(m => now - new Date(m.openShift!.clockIn).getTime() > FORGOTTEN_SHIFT_HOURS * 3600 * 1000)
  const requests = data.corrections.length + pendingMembers.length
  const radius = data.org.locations[0]?.radiusMeters ?? 1609
  const nameOf = (memberId: string) => data.members.find(m => m.id === memberId)?.name ?? 'Empleado'
  const sorted = [...active].sort((a, b) => Number(!!b.openShift) - Number(!!a.openShift) || a.name.localeCompare(b.name))

  const tabs: { value: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { value: 'now', label: 'Ahora', icon: <Activity className="h-4 w-4" /> },
    { value: 'hours', label: 'Horas', icon: <BarChart3 className="h-4 w-4" /> },
    { value: 'requests', label: 'Pedidos', icon: <Inbox className="h-4 w-4" />, badge: requests },
    { value: 'team', label: 'Equipo', icon: <Users className="h-4 w-4" />, badge: pendingMembers.length },
    { value: 'settings', label: 'Ajustes', icon: <Settings className="h-4 w-4" /> },
    { value: 'me', label: 'Mi turno', icon: <Clock className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-4">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-1 rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-1 shadow-sm" role="tablist">
          {tabs.map(t => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`relative flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all touch-manipulation ${tab === t.value ? 'bg-[#37352f] text-white shadow-sm' : 'text-[#787774] hover:bg-[rgba(55,53,47,0.06)]'}`}
            >
              {t.icon}
              {t.label}
              {!!t.badge && <span className="absolute right-1.5 top-1 min-w-[16px] rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-[16px] text-white">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === 'now' && (
        <div className="space-y-3">
          <section className="grid grid-cols-3 divide-x divide-[rgba(55,53,47,0.08)] rounded-xl border border-[rgba(55,53,47,0.09)] bg-white shadow-sm">
            <Stat label="Trabajando" value={`${working.length}/${active.length}`} tone="text-emerald-700" />
            <Stat label="Horas hoy" value={hm(active.reduce((sum, m) => sum + m.todaySeconds, 0))} />
            <Stat label="Esta semana" value={hm(active.reduce((sum, m) => sum + m.weekSeconds, 0))} />
          </section>

          {forgotten.length > 0 && (
            <section className="space-y-2 rounded-xl border border-red-200 bg-red-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-red-800">
                <AlertTriangle className="h-4 w-4" />
                ¿Olvidaron marcar la salida?
              </div>
              {forgotten.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-[13px] text-red-900">
                  <span>{m.name}: entró el {formatKeyShort(m.openShift!.date)} a las {formatTime12(m.openShift!.clockIn)}</span>
                  <button type="button" onClick={() => setSheet({ kind: 'edit', shift: m.openShift!, memberName: m.name, closeNow: true })} className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1 text-[12px] font-semibold text-red-800 shadow-sm">Cerrar turno</button>
                </div>
              ))}
            </section>
          )}

          {requests > 0 && (
            <button type="button" onClick={() => setTab('requests')} className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-left text-[13px] text-amber-900">
              <span><span className="font-semibold">{requests} {requests === 1 ? 'pedido pendiente' : 'pedidos pendientes'}</span> · correcciones o personas que quieren unirse</span>
              <span className="font-semibold">Ver</span>
            </button>
          )}

          <section className={cardClass}>
            <div className="mb-2 text-[14px] font-semibold text-[#37352f]">Equipo hoy</div>
            {sorted.length === 0 && (
              <p className="py-4 text-center text-[13px] text-[#787774]">
                Aún no hay empleados. <button type="button" onClick={() => setTab('team')} className="font-semibold text-[#37352f] underline">Invítalos con el código</button>
              </p>
            )}
            <div className="divide-y divide-[rgba(55,53,47,0.07)]">
              {sorted.map(m => {
                const open = m.openShift
                const elapsed = open ? Math.max(0, Math.floor((now - new Date(open.clockIn).getTime()) / 1000)) : 0
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2.5">
                    <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${open ? 'bg-emerald-500 animate-pulse' : 'bg-[#d3d1cb]'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-[#37352f]">{m.name}</div>
                      <div className="flex flex-wrap items-center gap-1 text-[12px] text-[#787774]">
                        {open ? (
                          <>
                            <span>Desde las {formatTime12(open.clockIn)} · {hm(elapsed)}</span>
                            {open.inDistance !== null && <Pill tone={open.inDistance <= radius ? 'green' : 'amber'}>{formatDistance(open.inDistance)}</Pill>}
                          </>
                        ) : (
                          <span>{m.todayShifts > 0 ? `Hoy ${hm(m.todaySeconds)} · ya salió` : 'Sin marcar hoy'}</span>
                        )}
                      </div>
                    </div>
                    {open && (
                      <button type="button" onClick={() => setSheet({ kind: 'edit', shift: open, memberName: m.name })} className="flex-shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold text-[#787774] hover:bg-[rgba(55,53,47,0.06)]">Ver</button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {tab === 'hours' && <AdminHours org={data.org} version={version} onOpenShift={setSheet} />}

      {tab === 'requests' && (
        <div className="space-y-3">
          {pendingMembers.length > 0 && (
            <button type="button" onClick={() => setTab('team')} className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-left text-[13px] text-amber-900">
              <span><span className="font-semibold">{pendingMembers.map(m => m.name).join(', ')}</span> {pendingMembers.length === 1 ? 'quiere' : 'quieren'} unirse</span>
              <span className="font-semibold">Revisar</span>
            </button>
          )}
          {data.corrections.length === 0 && pendingMembers.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-[13px] text-[#787774]">
              <Check className="h-6 w-6 text-emerald-600" />
              No hay pedidos pendientes
            </div>
          )}
          {data.corrections.map(shift => (
            <section key={shift.id} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold text-[#37352f]">{nameOf(shift.memberId)}</div>
                  <div className="text-[12px] text-[#787774]">
                    {formatKeyShort(shift.date)} · {formatTime12(shift.clockIn)} → {shift.clockOut ? formatTime12(shift.clockOut) : 'en curso'}
                  </div>
                </div>
                <Pill tone="amber">pide corrección</Pill>
              </div>
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-950">«{shift.correctionNote}»</p>
              <button type="button" onClick={() => setSheet({ kind: 'edit', shift, memberName: nameOf(shift.memberId) })} className="mt-2 w-full rounded-xl bg-[#37352f] py-2.5 text-[14px] font-semibold text-white">
                Revisar y corregir
              </button>
            </section>
          ))}
        </div>
      )}

      {tab === 'team' && <AdminTeam orgId={orgId} orgName={data.org.name} joinCode={data.joinCode} members={data.members} onChanged={changed} />}
      {tab === 'settings' && <AdminSettings org={data.org} onChanged={changed} />}
      {tab === 'me' && <EmployeeClock membership={{ ...membership, org: data.org }} />}

      {sheet && (
        <ShiftSheet
          key={sheet.kind === 'edit' ? sheet.shift.id : `new:${sheet.memberId}`}
          orgId={orgId}
          mode={sheet}
          onClose={() => setSheet(null)}
          onSaved={message => { setSheet(null); changed(message) }}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6">
          <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl bg-[#37352f] px-4 py-3 text-[13px] text-white shadow-xl animate-slide-up">
            <Check className="h-4 w-4 flex-shrink-0 text-emerald-300" />
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
