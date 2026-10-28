'use client'

import { useState } from 'react'
import { History, MapPin, Trash2 } from 'lucide-react'
import { TimeField } from '@/components/TimeField'
import { formatDistance, mapsLink } from '@/lib/geo'
import { formatTime12, formatKeyShort } from '@/lib/report-format'
import { getFloridaDateComponents, getFloridaDateString } from '@/lib/utils'
import type { OrgShiftInfo } from '@/lib/org-shared'
import { ErrorBox, Pill, Sheet, api, inputClass, labelClass, primaryButton, secondaryButton } from './ui'

export type ShiftSheetMode =
  | { kind: 'edit'; shift: OrgShiftInfo; memberName: string; closeNow?: boolean }
  | { kind: 'create'; memberId: string; memberName: string; date?: string }

interface Props {
  readonly orgId: string
  readonly mode: ShiftSheetMode
  readonly onClose: () => void
  readonly onSaved: (message: string) => void
}

interface HistoryItem {
  id: string
  action: string
  reason: string
  editor: string
  createdAt: string
  before: { clockIn: string; clockOut: string | null; breakSeconds: number } | null
  after: { clockIn: string; clockOut: string | null; breakSeconds: number } | null
}

/** Instante → fecha y hora de pared de Florida para los campos */
function wall(iso: string): { date: string; time: string } {
  const c = getFloridaDateComponents(new Date(iso))
  return {
    date: `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`,
    time: `${String(c.hour % 24).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`,
  }
}

const ACTIONS: Record<string, string> = {
  create: 'Agregó el turno',
  update: 'Cambió las horas',
  delete: 'Borró el turno',
  resolve: 'Resolvió el pedido',
  reject: 'Rechazó el pedido',
}

function describeTimes(t: HistoryItem['before']): string {
  if (!t) return '—'
  return `${formatTime12(t.clockIn)} → ${t.clockOut ? formatTime12(t.clockOut) : 'abierto'}${t.breakSeconds ? ` (−${Math.round(t.breakSeconds / 60)} min)` : ''}`
}

function LocationLine({ label, lat, lng, distance, accuracy }: { readonly label: string; readonly lat: number | null; readonly lng: number | null; readonly distance: number | null; readonly accuracy: number | null }) {
  if (lat === null || lng === null) {
    return <div className="flex items-center gap-1.5 text-[12px] text-[#787774]"><MapPin className="h-3.5 w-3.5" />{label}: sin ubicación</div>
  }
  return (
    <a href={mapsLink(lat, lng)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] text-[#37352f] underline-offset-2 hover:underline">
      <MapPin className="h-3.5 w-3.5 text-[#787774]" />
      {label}: {distance === null ? 'ubicación registrada' : `a ${formatDistance(distance)} de la oficina`}
      {accuracy !== null && <span className="text-[#9b9a97]"> (±{formatDistance(accuracy)})</span>}
      <span className="text-[#9b9a97]">· ver mapa</span>
    </a>
  )
}

export function ShiftSheet({ orgId, mode, onClose, onSaved }: Props) {
  const shift = mode.kind === 'edit' ? mode.shift : null
  const initialIn = shift ? wall(shift.clockIn) : { date: mode.kind === 'create' ? mode.date ?? getFloridaDateString() : getFloridaDateString(), time: '08:00' }
  const nowWall = wall(new Date().toISOString())
  // Cerrar un turno olvidado: la hora de ahora solo tiene sentido si entró hoy
  let initialOut = shift ? '' : '17:00'
  if (shift?.clockOut) initialOut = wall(shift.clockOut).time
  else if (mode.kind === 'edit' && mode.closeNow && initialIn.date === nowWall.date) initialOut = nowWall.time

  const [date, setDate] = useState(initialIn.date)
  const [start, setStart] = useState(initialIn.time)
  const [end, setEnd] = useState(initialOut)
  const [stillWorking, setStillWorking] = useState(shift ? !shift.clockOut && !(mode.kind === 'edit' && mode.closeNow) : false)
  const [breakMinutes, setBreakMinutes] = useState(shift ? String(Math.round(shift.breakSeconds / 60)) : '')
  const [reason, setReason] = useState(mode.kind === 'edit' && mode.closeNow ? 'Olvidó marcar la salida' : '')
  const pendingCorrection = shift?.correctionStatus === 'pending'
  const [resolveRequest, setResolveRequest] = useState(pendingCorrection)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [history, setHistory] = useState<HistoryItem[] | null>(null)

  const times = { date, start, end: stillWorking ? null : end, breakMinutes: breakMinutes === '' ? undefined : Number(breakMinutes) }

  const save = async () => {
    setBusy(true)
    setError(null)
    const result = mode.kind === 'create'
      ? await api(`/api/org/${orgId}/admin/shifts`, 'POST', { memberId: mode.memberId, ...times, reason })
      : await api(`/api/org/${orgId}/admin/shifts/${shift!.id}`, 'PATCH', {
          ...times,
          reason,
          ...(pendingCorrection && resolveRequest ? { correction: 'resolved', adminNote: reply.trim() || 'Corregido' } : {}),
        })
    setBusy(false)
    if (result.error) setError(result.error)
    else onSaved(mode.kind === 'create' ? `Turno agregado a ${mode.memberName}` : `Turno de ${mode.memberName} corregido`)
  }

  const reject = async () => {
    if (!shift) return
    setBusy(true)
    setError(null)
    const result = await api(`/api/org/${orgId}/admin/shifts/${shift.id}`, 'PATCH', { correction: 'rejected', adminNote: reply.trim() || 'Las horas registradas son correctas' })
    setBusy(false)
    if (result.error) setError(result.error)
    else onSaved(`Pedido de ${mode.memberName} rechazado`)
  }

  const remove = async () => {
    if (!shift) return
    setBusy(true)
    setError(null)
    const result = await api(`/api/org/${orgId}/admin/shifts/${shift.id}?reason=${encodeURIComponent(reason)}`, 'DELETE')
    setBusy(false)
    if (result.error) { setError(result.error); setConfirmDelete(false) }
    else onSaved(`Turno de ${mode.memberName} borrado`)
  }

  const loadHistory = async () => {
    if (!shift) return
    const result = await api<HistoryItem[]>(`/api/org/${orgId}/admin/shifts/${shift.id}`)
    setHistory(result.data ?? [])
  }

  const title = mode.kind === 'create' ? 'Agregar turno' : shift && !shift.clockOut ? 'Turno en curso' : 'Corregir turno'
  const subtitle = shift
    ? `${mode.memberName} · ${formatKeyShort(shift.date)} · ${formatTime12(shift.clockIn)} → ${shift.clockOut ? formatTime12(shift.clockOut) : 'en curso'}`
    : mode.memberName

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
      <div className="space-y-4">
        {pendingCorrection && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-amber-800">Pedido del empleado</div>
            <p className="mt-1 text-[14px] text-amber-950">«{shift!.correctionNote}»</p>
          </div>
        )}

        {shift && (
          <div className="space-y-1 rounded-xl bg-[rgba(55,53,47,0.04)] p-3">
            <div className="mb-1 flex flex-wrap gap-1">
              <Pill tone={shift.source === 'admin' ? 'gray' : 'green'}>{shift.source === 'admin' ? 'Agregado por un administrador' : 'Marcado por el empleado'}</Pill>
              {shift.edited && <Pill tone="gray">Con cambios</Pill>}
            </div>
            <LocationLine label="Entrada" lat={shift.inLatitude} lng={shift.inLongitude} distance={shift.inDistance} accuracy={shift.inAccuracy} />
            {shift.clockOut && <LocationLine label="Salida" lat={shift.outLatitude} lng={shift.outLongitude} distance={shift.outDistance} accuracy={shift.outAccuracy} />}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className={`${labelClass} col-span-2`}>
            Fecha de entrada
            <input type="date" value={date} max={getFloridaDateString()} onChange={e => setDate(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
          </label>
          <div className={labelClass}>
            Entrada
            <TimeField value={start} onChange={setStart} title="Hora de entrada" className={inputClass} />
          </div>
          <div className={labelClass}>
            Salida
            {stillWorking
              ? <div className={`${inputClass} text-emerald-700`}>Sigue trabajando</div>
              : <TimeField value={end} onChange={setEnd} title="Hora de salida" className={inputClass} />}
          </div>
          {(mode.kind === 'create' || !shift?.clockOut) && (
            <label className="col-span-2 flex items-center gap-2 text-[13px] text-[#37352f]">
              <input type="checkbox" checked={stillWorking} onChange={e => setStillWorking(e.target.checked)} className="h-4 w-4 accent-[#37352f]" />
              Todavía no ha salido (dejar el turno abierto)
            </label>
          )}
          <label className={`${labelClass} col-span-2`}>
            Break sin pago
            <select value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)} className={inputClass} style={{ fontSize: '16px' }}>
              {mode.kind === 'create' && <option value="">Según la empresa</option>}
              {[0, 15, 30, 45, 60].map(m => <option key={m} value={m}>{m === 0 ? 'Sin break' : `${m} min`}</option>)}
            </select>
          </label>
        </div>

        <label className={labelClass}>
          Motivo del cambio (obligatorio, queda en el historial)
          <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={300} rows={2} placeholder="Ej: Olvidó marcar la salida; confirmado con el supervisor" className={`${inputClass} resize-none`} style={{ fontSize: '16px' }} />
        </label>

        {pendingCorrection && (
          <div className="space-y-2 rounded-xl border border-[rgba(55,53,47,0.12)] p-3">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-[#37352f]">
              <input type="checkbox" checked={resolveRequest} onChange={e => setResolveRequest(e.target.checked)} className="h-4 w-4 accent-[#37352f]" />
              Al guardar, marcar el pedido como resuelto
            </label>
            <label className={labelClass}>
              Respuesta para el empleado (opcional)
              <input type="text" value={reply} onChange={e => setReply(e.target.value)} maxLength={300} placeholder="Ej: Corregido, gracias por avisar" className={inputClass} style={{ fontSize: '16px' }} />
            </label>
          </div>
        )}

        <ErrorBox>{error}</ErrorBox>

        <div className="grid grid-cols-2 gap-2">
          {pendingCorrection ? (
            <button type="button" onClick={reject} disabled={busy} className={secondaryButton}>Rechazar pedido</button>
          ) : (
            <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          )}
          <button type="button" onClick={save} disabled={busy || reason.trim().length < 3} className={primaryButton}>
            {busy ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        {shift && (
          <div className="space-y-3 border-t border-[rgba(55,53,47,0.09)] pt-3">
            {confirmDelete ? (
              <div className="space-y-2 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-[13px] text-[#991b1b]">
                <p>¿Borrar este turno? Deja de contar en las horas, pero queda en el historial con el motivo que escribiste arriba.</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 font-semibold text-[#787774]">No</button>
                  <button type="button" onClick={remove} disabled={busy || reason.trim().length < 3} className="rounded-lg bg-[#dc2626] px-3 py-1.5 font-semibold text-white disabled:opacity-50">Sí, borrar</button>
                </div>
                {reason.trim().length < 3 && <p className="text-[12px]">Escribe primero el motivo.</p>}
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#787774] hover:text-[#dc2626]">
                <Trash2 className="h-4 w-4" />
                Borrar turno
              </button>
            )}

            {history === null ? (
              <button type="button" onClick={loadHistory} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#787774] hover:text-[#37352f]">
                <History className="h-4 w-4" />
                Ver historial de cambios
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-[#787774]">Historial</div>
                {history.length === 0 && <p className="text-[13px] text-[#787774]">Sin cambios: así lo marcó el empleado.</p>}
                {history.map(item => (
                  <div key={item.id} className="rounded-lg border border-[rgba(55,53,47,0.09)] px-3 py-2 text-[12px]">
                    <div className="flex justify-between gap-2 font-semibold text-[#37352f]">
                      <span>{ACTIONS[item.action] ?? item.action}</span>
                      <span className="font-normal text-[#9b9a97]">{formatKeyShort(wall(item.createdAt).date)} {formatTime12(item.createdAt)}</span>
                    </div>
                    <div className="text-[#787774]">Por {item.editor}: «{item.reason}»</div>
                    {(item.before || item.after) && (
                      <div className="mt-0.5 text-[#37352f]">
                        {item.before && <span className="line-through decoration-[#c4c3c0]">{describeTimes(item.before)}</span>}
                        {item.before && item.after && ' → '}
                        {item.after && <span>{describeTimes(item.after)}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
