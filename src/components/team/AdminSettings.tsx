'use client'

import { useState } from 'react'
import { Crosshair, ExternalLink, MapPin, Search } from 'lucide-react'
import { BREAK_AFTER_OPTIONS, BREAK_MINUTE_OPTIONS, DAY_NAMES } from '@/lib/companies'
import { METERS_PER_MILE, mapsLink } from '@/lib/geo'
import type { OrgSettings } from '@/lib/org-shared'
import { ErrorBox, api, cardClass, inputClass, labelClass, primaryButton } from './ui'

export const RADIUS_OPTIONS = [0.25, 0.5, 1, 2, 5]

const chip = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors touch-manipulation ${active ? 'bg-[#37352f] text-white' : 'bg-[rgba(55,53,47,0.06)] text-[#37352f] hover:bg-[rgba(55,53,47,0.12)]'}`

interface Point { latitude: number; longitude: number; label: string }

/** Oficina: dirección (se busca en el mapa) o la ubicación actual, y el radio */
export function OfficeFields({ address, onAddress, point, onPoint, radius, onRadius }: {
  readonly address: string
  readonly onAddress: (value: string) => void
  readonly point: Point | null
  readonly onPoint: (point: Point | null) => void
  readonly radius: number
  readonly onRadius: (miles: number) => void
}) {
  const [busy, setBusy] = useState<'search' | 'here' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    setBusy('search')
    setError(null)
    const result = await api<{ latitude: number; longitude: number; label: string }>(`/api/org/geocode?q=${encodeURIComponent(address)}`)
    setBusy(null)
    if (result.data) onPoint(result.data)
    else setError(result.error)
  }

  const useHere = () => {
    setBusy('here')
    setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setBusy(null)
        onPoint({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, label: 'Tu ubicación actual' })
      },
      () => {
        setBusy(null)
        setError('No se pudo obtener tu ubicación. Permite el acceso y activa el GPS.')
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  }

  return (
    <div className="space-y-3">
      <label className={labelClass}>
        Dirección de la oficina
        <div className="flex gap-2">
          <input type="text" value={address} onChange={e => { onAddress(e.target.value); onPoint(null) }} placeholder="Ej: 4700 SW 30th St, Davie, FL 33314" className={inputClass} style={{ fontSize: '16px' }} />
          <button type="button" onClick={search} disabled={busy !== null || address.trim().length < 5} aria-label="Buscar dirección" className="mt-0.5 flex-shrink-0 rounded-lg bg-[#37352f] px-3 text-white disabled:opacity-40">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </label>
      <button type="button" onClick={useHere} disabled={busy !== null} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#37352f] underline-offset-2 hover:underline disabled:opacity-50">
        <Crosshair className="h-4 w-4" />
        {busy === 'here' ? 'Buscando...' : 'Estoy en la oficina: usar mi ubicación actual'}
      </button>
      {busy === 'search' && <p className="text-[12px] text-[#787774]">Buscando la dirección...</p>}
      {point && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900 animate-fade-in">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="min-w-0">
            <span className="block font-semibold">Ubicada: {point.label}</span>
            <a href={mapsLink(point.latitude, point.longitude)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
              Verificar en el mapa <ExternalLink className="h-3 w-3" />
            </a>
          </span>
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>
      <div>
        <div className="mb-1.5 text-[11px] text-[#787774]">Radio para marcar</div>
        <div className="flex flex-wrap gap-1.5">
          {RADIUS_OPTIONS.map(miles => (
            <button key={miles} type="button" onClick={() => onRadius(miles)} className={chip(radius === miles)}>
              {miles === 1 ? '1 milla' : `${miles} millas`}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AdminSettings({ org, onChanged }: { readonly org: OrgSettings; readonly onChanged: (message: string) => void }) {
  const office = org.locations[0]
  const [name, setName] = useState(org.name)
  const [weekStartsOn, setWeekStartsOn] = useState(org.weekStartsOn)
  const [requireLocation, setRequireLocation] = useState(org.requireLocation)
  const [overtimeAfter, setOvertimeAfter] = useState(String(org.overtimeAfterHours))
  const [multiplier, setMultiplier] = useState(String(org.overtimeMultiplier))
  const [breakMinutes, setBreakMinutes] = useState(org.breakMinutes)
  const [breakAfter, setBreakAfter] = useState(org.breakAfterHours)
  const [address, setAddress] = useState(office?.address ?? '')
  const [point, setPoint] = useState<Point | null>(office ? { latitude: office.latitude, longitude: office.longitude, label: office.address } : null)
  const [radius, setRadius] = useState(() => {
    const miles = (office?.radiusMeters ?? METERS_PER_MILE) / METERS_PER_MILE
    return RADIUS_OPTIONS.reduce((best, r) => (Math.abs(r - miles) < Math.abs(best - miles) ? r : best), 1)
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    const result = await api(`/api/org/${org.id}/admin`, 'PATCH', {
      name,
      weekStartsOn,
      requireLocation,
      overtimeAfterHours: overtimeAfter,
      overtimeMultiplier: multiplier,
      breakMinutes,
      breakAfterHours: breakAfter,
      location: { name: 'Oficina', address, radiusMiles: radius, ...(point ? { latitude: point.latitude, longitude: point.longitude } : {}) },
    })
    setBusy(false)
    if (result.error) setError(result.error)
    else onChanged('Ajustes guardados')
  }

  return (
    <div className="space-y-3">
      <section className={`${cardClass} space-y-3`}>
        <div className="text-[14px] font-semibold text-[#37352f]">Empresa</div>
        <label className={labelClass}>
          Nombre
          <input type="text" value={name} maxLength={80} onChange={e => setName(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
        </label>
        <label className={labelClass}>
          La semana de pago empieza el
          <select value={weekStartsOn} onChange={e => setWeekStartsOn(Number(e.target.value))} className={inputClass} style={{ fontSize: '16px' }}>
            {DAY_NAMES.map((day, i) => <option key={day} value={i}>{day}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>
            Overtime después de (h/semana)
            <input type="number" inputMode="decimal" min="1" step="0.5" value={overtimeAfter} onChange={e => setOvertimeAfter(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
          </label>
          <label className={labelClass}>
            Multiplicador
            <input type="number" inputMode="decimal" min="1" step="0.25" value={multiplier} onChange={e => setMultiplier(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
          </label>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] text-[#787774]">Break sin pago al marcar la salida</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setBreakMinutes(0)} className={chip(breakMinutes === 0)}>Ninguno</button>
            {BREAK_MINUTE_OPTIONS.map(m => <button key={m} type="button" onClick={() => setBreakMinutes(m)} className={chip(breakMinutes === m)}>{m} min</button>)}
          </div>
          {breakMinutes > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 animate-fade-in">
              {BREAK_AFTER_OPTIONS.map(o => <button key={o.hours} type="button" onClick={() => setBreakAfter(o.hours)} className={chip(breakAfter === o.hours)}>{o.label}</button>)}
            </div>
          )}
        </div>
      </section>

      <section className={`${cardClass} space-y-3`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-[#37352f]">Marcar solo desde la oficina</div>
            <div className="text-[12px] text-[#787774]">{requireLocation ? 'El teléfono debe estar dentro del radio para marcar' : 'Se puede marcar desde cualquier lugar'}</div>
          </div>
          <button type="button" role="switch" aria-checked={requireLocation} aria-label="Exigir ubicación" onClick={() => setRequireLocation(!requireLocation)} className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${requireLocation ? 'bg-[#37352f]' : 'bg-[rgba(55,53,47,0.2)]'}`}>
            <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${requireLocation ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <OfficeFields address={address} onAddress={setAddress} point={point} onPoint={setPoint} radius={radius} onRadius={setRadius} />
      </section>

      <ErrorBox>{error}</ErrorBox>
      <button type="button" onClick={save} disabled={busy} className={`${primaryButton} w-full`}>
        {busy ? 'Guardando...' : 'Guardar ajustes'}
      </button>
    </div>
  )
}
