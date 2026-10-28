'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Loader2, LogIn, LogOut, MapPin, MessageSquareWarning, ShieldCheck } from 'lucide-react'
import { addDaysToKey } from '@/lib/companies'
import { formatDistance } from '@/lib/geo'
import { formatKeyShort, formatTime12, hoursDecimal, money } from '@/lib/report-format'
import { paidSeconds, type MemberWeek, type OrgMembership, type OrgShiftInfo } from '@/lib/org-shared'
import { ErrorBox, Pill, SuccessBox, api, cardClass, hm, inputClass } from './ui'

interface ClockData {
  serverTime: string
  openShift: OrgShiftInfo | null
  week: { start: string; end: string; isCurrent: boolean }
  previousWeek: string
  summary: MemberWeek
}

/** Ubicación del teléfono (pide permiso la primera vez) */
function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este navegador no puede compartir la ubicación'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  })
}

function locationError(error: unknown): string {
  const code = (error as GeolocationPositionError)?.code
  if (code === 1) return 'Permite el acceso a tu ubicación: toca el candado junto a la dirección de la página → Ubicación → Permitir, y vuelve a intentar.'
  if (code === 2) return 'No se pudo obtener tu ubicación. Activa el GPS del teléfono y vuelve a intentar.'
  if (code === 3) return 'Tardó demasiado en encontrar tu ubicación. Sal a un lugar abierto y vuelve a intentar.'
  return error instanceof Error ? error.message : 'No se pudo obtener tu ubicación'
}

function ShiftRow({ orgId, shift, onChanged }: { readonly orgId: string; readonly shift: OrgShiftInfo; readonly onChanged: () => void }) {
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setBusy(true)
    setError(null)
    const result = await api(`/api/org/${orgId}/shifts/${shift.id}/correction`, 'POST', { note })
    setBusy(false)
    if (result.error) setError(result.error)
    else { setAsking(false); setNote(''); onChanged() }
  }

  const cancel = async () => {
    setBusy(true)
    const result = await api(`/api/org/${orgId}/shifts/${shift.id}/correction`, 'DELETE')
    setBusy(false)
    if (result.error) setError(result.error)
    else onChanged()
  }

  return (
    <div className="rounded-xl border border-[rgba(55,53,47,0.12)] bg-white px-3.5 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9b9a97]">{formatKeyShort(shift.date)}</div>
          <div className="font-mono text-[14px] font-semibold text-[#37352f]">
            {formatTime12(shift.clockIn)}
            <span className="mx-1.5 text-[#c4c3c0]">→</span>
            {shift.clockOut ? formatTime12(shift.clockOut) : <span className="font-sans text-emerald-700">en curso</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[14px] font-bold text-[#37352f]">{shift.clockOut ? `${hoursDecimal(paidSeconds(shift))} h` : '—'}</div>
          {shift.breakSeconds > 0 && <div className="text-[11px] text-[#787774]">−{Math.round(shift.breakSeconds / 60)} min break</div>}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {shift.source === 'admin' && <Pill tone="gray">Agregado por el administrador</Pill>}
        {shift.source === 'clock' && shift.edited && <Pill tone="gray">Corregido por el administrador</Pill>}
        {shift.correctionStatus === 'pending' && <Pill tone="amber">Corrección pedida</Pill>}
        {shift.correctionStatus === 'resolved' && <Pill tone="green">Corrección resuelta</Pill>}
        {shift.correctionStatus === 'rejected' && <Pill tone="red">Corrección rechazada</Pill>}
      </div>
      {shift.correctionNote && shift.correctionStatus === 'pending' && (
        <p className="mt-1.5 text-[12px] text-[#787774]">Tu pedido: «{shift.correctionNote}»</p>
      )}
      {shift.adminNote && <p className="mt-1.5 text-[12px] text-[#37352f]">Administrador: «{shift.adminNote}»</p>}

      {asking ? (
        <div className="mt-2 space-y-2 animate-fade-in">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Ej: Salí a las 5:30 PM, no pude marcar"
            className={`${inputClass} resize-none`}
            style={{ fontSize: '16px' }}
          />
          <ErrorBox>{error}</ErrorBox>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAsking(false)} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#787774] hover:bg-[rgba(55,53,47,0.06)]">Cancelar</button>
            <button type="button" onClick={send} disabled={busy || note.trim().length < 5} className="rounded-lg bg-[#37352f] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">
              {busy ? 'Enviando...' : 'Enviar al administrador'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex justify-end">
          {shift.correctionStatus === 'pending' ? (
            <button type="button" onClick={cancel} disabled={busy} className="text-[12px] font-semibold text-[#787774] underline underline-offset-2">Retirar pedido</button>
          ) : (
            <button type="button" onClick={() => setAsking(true)} className="flex items-center gap-1 text-[12px] font-semibold text-[#787774] hover:text-[#37352f]">
              <MessageSquareWarning className="h-3.5 w-3.5" />
              ¿Algo está mal? Pedir corrección
            </button>
          )}
        </div>
      )}
      {!asking && error && <div className="mt-2"><ErrorBox>{error}</ErrorBox></div>}
    </div>
  )
}

export function EmployeeClock({ membership }: { readonly membership: OrgMembership }) {
  const org = membership.org
  const [week, setWeek] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [data, setData] = useState<ClockData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'locating' | 'sending' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<ClockData>(`/api/org/${org.id}/clock${week ? `?week=${week}` : ''}`).then(result => {
      if (cancelled) return
      if (result.data) {
        setData(result.data)
        setOffset(new Date(result.data.serverTime).getTime() - Date.now())
        setLoadError(null)
      } else {
        setLoadError(result.error)
      }
    })
    return () => { cancelled = true }
  }, [org.id, week, version])

  // Reloj en vivo del turno abierto (con la hora del servidor)
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset)
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [offset])

  const open = data?.openShift ?? null
  const office = org.locations[0]

  const punch = async () => {
    const action = open ? 'out' : 'in'
    setError(null)
    setSuccess(null)
    let coords: { latitude?: number; longitude?: number; accuracy?: number } = {}
    setBusy('locating')
    try {
      const position = await locate()
      coords = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }
    } catch (err) {
      if (org.requireLocation) {
        setBusy(null)
        setError(locationError(err))
        return
      }
    }
    setBusy('sending')
    const result = await api<{ shift: OrgShiftInfo }>(`/api/org/${org.id}/clock`, 'POST', { action, ...coords })
    setBusy(null)
    if (result.error || !result.data) {
      setError(result.error)
      return
    }
    const shift = result.data.shift
    const distance = action === 'in' ? shift.inDistance : shift.outDistance
    const where = distance === null ? '' : ` · a ${formatDistance(distance)} de ${office?.name ?? 'la oficina'}`
    setSuccess(action === 'in'
      ? `Entrada marcada a las ${formatTime12(shift.clockIn)}${where}`
      : `Salida marcada a las ${formatTime12(shift.clockOut!)} · ${hm(paidSeconds(shift))} trabajadas${where}`)
    setWeek(null)
    setVersion(v => v + 1)
  }

  if (loadError) return <ErrorBox>{loadError}</ErrorBox>
  if (!data) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#787774]" /></div>
  }

  const elapsed = open && now > 0 ? Math.max(0, Math.floor((now - new Date(open.clockIn).getTime()) / 1000)) : 0
  const summary = data.summary
  const shifts = [...summary.shifts].reverse()

  return (
    <div className="space-y-4">
      {/* Marcar */}
      <section className={`${cardClass} text-center`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#787774]">{org.name}</div>
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${open ? 'bg-emerald-50 text-emerald-700' : 'bg-[rgba(55,53,47,0.06)] text-[#787774]'}`}>
          <span className={`h-2 w-2 rounded-full ${open ? 'bg-emerald-500 animate-pulse' : 'bg-[#c4c3c0]'}`} />
          {open ? `Trabajando desde las ${formatTime12(open.clockIn)}` : 'Fuera de turno'}
        </div>
        <div className={`mt-3 font-mono text-[52px] font-bold leading-none tabular-nums ${open ? 'text-[#37352f]' : 'text-[rgba(55,53,47,0.25)]'}`}>
          {String(Math.floor(elapsed / 3600)).padStart(2, '0')}:{String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
        </div>

        <button
          type="button"
          onClick={punch}
          disabled={busy !== null}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[17px] font-bold text-white shadow-sm transition-transform active:scale-[0.99] disabled:opacity-70 touch-manipulation ${open ? 'bg-[#37352f] hover:bg-[#2f2d28]' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : open ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
          {busy === 'locating' && 'Buscando tu ubicación...'}
          {busy === 'sending' && 'Marcando...'}
          {!busy && (open ? 'MARCAR SALIDA' : 'MARCAR ENTRADA')}
        </button>

        <div className="mt-3 flex items-start justify-center gap-1.5 text-[12px] text-[#787774]">
          {org.requireLocation ? <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> : <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
          <span>
            {org.requireLocation && office
              ? `Debes estar a menos de ${formatDistance(office.radiusMeters)} de ${office.address}.`
              : 'La hora la registra el sistema.'}
          </span>
        </div>

        <div className="mt-3 space-y-2 text-left">
          <SuccessBox>{success}</SuccessBox>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 animate-fade-in">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </section>

      {/* Semana */}
      <section className={cardClass}>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setWeek(data.previousWeek)} aria-label="Semana anterior" className="rounded-lg p-2 text-[#787774] hover:bg-[rgba(55,53,47,0.08)]">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <div className="text-[12px] font-medium uppercase tracking-wide text-[#787774]">{data.week.isCurrent ? 'Esta semana' : 'Semana'}</div>
            <div className="text-[13px] font-semibold text-[#37352f]">{formatKeyShort(data.week.start)} → {formatKeyShort(data.week.end)}</div>
          </div>
          <button type="button" onClick={() => setWeek(addDaysToKey(data.week.start, 7))} disabled={data.week.isCurrent} aria-label="Semana siguiente" className="rounded-lg p-2 text-[#787774] hover:bg-[rgba(55,53,47,0.08)] disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 divide-x divide-[rgba(55,53,47,0.08)] rounded-lg bg-[rgba(55,53,47,0.03)] text-center">
          <div className="px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Horas</div>
            <div className="text-[15px] font-bold text-[#37352f]">{hoursDecimal(summary.totalSeconds)}</div>
          </div>
          <div className="px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Overtime</div>
            <div className={`text-[15px] font-bold ${summary.overtimeSeconds > 0 ? 'text-[#9a4a0b]' : 'text-[#37352f]'}`}>{hoursDecimal(summary.overtimeSeconds)}</div>
          </div>
          <div className="px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Estimado</div>
            <div className="text-[15px] font-bold text-emerald-700">{summary.member.hourlyRate > 0 ? money(summary.totalPay) : '—'}</div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {shifts.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-6 text-center text-[13px] text-[#787774]">
              <Clock className="h-5 w-5" />
              Sin turnos esta semana
            </div>
          ) : (
            shifts.map(shift => <ShiftRow key={shift.id} orgId={org.id} shift={shift} onChanged={() => setVersion(v => v + 1)} />)
          )}
        </div>
        <p className="mt-3 text-[11px] text-[#9b9a97]">
          Las horas las registra el sistema al marcar y solo el administrador puede cambiarlas. Si algo está mal, pide una corrección.
        </p>
      </section>
    </div>
  )
}
