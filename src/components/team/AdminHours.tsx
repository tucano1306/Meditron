'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Download, Flame, Loader2, Plus } from 'lucide-react'
import { addDaysToKey } from '@/lib/companies'
import { formatDistance } from '@/lib/geo'
import { formatKeyShort, formatTime12, hoursDecimal, money } from '@/lib/report-format'
import { paidSeconds, type MemberWeek, type OrgSettings, type OrgShiftInfo } from '@/lib/org-shared'
import { ErrorBox, Pill, api, cardClass, secondaryButton } from './ui'
import type { ShiftSheetMode } from './ShiftSheet'

interface Timesheet {
  start: string
  end: string
  members: MemberWeek[]
  totals: { seconds: number; overtimeSeconds: number; pay: number }
}

/** Distancia al marcar: verde dentro del radio, ámbar sin GPS o fuera */
function DistancePill({ distance, radius }: { readonly distance: number | null; readonly radius: number }) {
  if (distance === null) return <Pill tone="amber">sin GPS</Pill>
  return <Pill tone={distance <= radius ? 'green' : 'amber'}>{formatDistance(distance)}</Pill>
}

function ShiftLine({ shift, radius, onOpen }: { readonly shift: OrgShiftInfo; readonly radius: number; readonly onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-lg border border-[rgba(55,53,47,0.09)] bg-white px-3 py-2 text-left transition-colors hover:bg-[rgba(55,53,47,0.03)] touch-manipulation">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9b9a97]">{formatKeyShort(shift.date)}</div>
          <div className="font-mono text-[13px] font-semibold text-[#37352f]">
            {formatTime12(shift.clockIn)} → {shift.clockOut ? formatTime12(shift.clockOut) : <span className="font-sans text-emerald-700">en curso</span>}
          </div>
        </div>
        <div className="text-right text-[13px] font-bold text-[#37352f]">{shift.clockOut ? `${hoursDecimal(paidSeconds(shift))} h` : '—'}</div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {shift.source === 'admin' ? <Pill tone="gray">agregado por admin</Pill> : (
          <>
            <DistancePill distance={shift.inDistance} radius={radius} />
            {shift.clockOut && <DistancePill distance={shift.outDistance} radius={radius} />}
          </>
        )}
        {shift.edited && shift.source === 'clock' && <Pill tone="blue">corregido</Pill>}
        {shift.breakSeconds > 0 && <Pill tone="gray">−{Math.round(shift.breakSeconds / 60)} min break</Pill>}
        {shift.correctionStatus === 'pending' && <Pill tone="amber">pide corrección</Pill>}
      </div>
    </button>
  )
}

interface Props {
  readonly org: OrgSettings
  readonly version: number
  readonly onOpenShift: (mode: ShiftSheetMode) => void
}

export function AdminHours({ org, version, onOpenShift }: Props) {
  const [week, setWeek] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Timesheet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const radius = org.locations[0]?.radiusMeters ?? 1609

  useEffect(() => {
    let cancelled = false
    api<Timesheet>(`/api/org/${org.id}/admin/timesheet${week ? `?week=${week}` : ''}`).then(result => {
      if (cancelled) return
      if (result.data) { setSheet(result.data); setError(null) } else setError(result.error)
    })
    return () => { cancelled = true }
  }, [org.id, week, version])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!sheet) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#787774]" /></div>

  const isCurrent = week === null

  return (
    <div className="space-y-3">
      <section className={cardClass}>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setWeek(addDaysToKey(sheet.start, -7))} aria-label="Semana anterior" className="rounded-lg p-2 text-[#787774] hover:bg-[rgba(55,53,47,0.08)]">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <div className="text-[12px] font-medium uppercase tracking-wide text-[#787774]">{isCurrent ? 'Semana actual' : 'Semana de pago'}</div>
            <div className="text-[14px] font-semibold text-[#37352f]">{formatKeyShort(sheet.start)} → {formatKeyShort(sheet.end)}</div>
          </div>
          <button type="button" onClick={() => setWeek(addDaysToKey(sheet.start, 7))} disabled={isCurrent} aria-label="Semana siguiente" className="rounded-lg p-2 text-[#787774] hover:bg-[rgba(55,53,47,0.08)] disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-[rgba(55,53,47,0.08)] rounded-lg bg-[rgba(55,53,47,0.03)] text-center">
          <div className="px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Horas</div>
            <div className="text-[15px] font-bold text-[#37352f]">{hoursDecimal(sheet.totals.seconds)}</div>
          </div>
          <div className="px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Overtime</div>
            <div className={`text-[15px] font-bold ${sheet.totals.overtimeSeconds > 0 ? 'text-[#9a4a0b]' : 'text-[#37352f]'}`}>{hoursDecimal(sheet.totals.overtimeSeconds)}</div>
          </div>
          <div className="px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-[#9b9a97]">Nómina</div>
            <div className="text-[15px] font-bold text-emerald-700">{money(sheet.totals.pay)}</div>
          </div>
        </div>
        <a href={`/api/org/${org.id}/admin/timesheet?week=${sheet.start}&format=csv`} className={`${secondaryButton} mt-3 w-full`}>
          <Download className="h-4 w-4" />
          Descargar para nómina (Excel / CSV)
        </a>
      </section>

      {sheet.members.length === 0 && (
        <div className="py-6 text-center text-[13px] text-[#787774]">Todavía no hay empleados activos.</div>
      )}

      {sheet.members.map(w => {
        const open = expanded === w.member.id
        return (
          <section key={w.member.id} className={`overflow-hidden rounded-xl transition-all ${open ? 'bg-white shadow-md ring-2 ring-[#37352f]' : 'bg-white shadow-sm ring-1 ring-[rgba(55,53,47,0.12)]'}`}>
            <button type="button" onClick={() => setExpanded(open ? null : w.member.id)} className="flex w-full items-center justify-between gap-2 p-3 text-left touch-manipulation">
              <div className="flex min-w-0 items-center gap-2">
                {open ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-[#37352f]">
                    {w.member.name}
                    {w.openShift && <Pill tone="green">trabajando</Pill>}
                    {w.overtimeSeconds > 0 && <Pill tone="amber"><Flame className="h-2.5 w-2.5" />OT {hoursDecimal(w.overtimeSeconds)} h</Pill>}
                    {w.pendingCorrections > 0 && <Pill tone="amber">{w.pendingCorrections} pedido{w.pendingCorrections === 1 ? '' : 's'}</Pill>}
                    {w.member.status === 'inactive' && <Pill tone="gray">inactivo</Pill>}
                  </div>
                  <div className="text-[11px] text-[#787774]">{w.shifts.length} {w.shifts.length === 1 ? 'turno' : 'turnos'} · ${w.member.hourlyRate}/h</div>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-[14px] font-bold text-[#37352f]">{hoursDecimal(w.totalSeconds)} h</div>
                <div className="text-[12px] font-semibold text-emerald-700">{money(w.totalPay)}</div>
              </div>
            </button>
            {open && (
              <div className="space-y-2 border-t border-[rgba(55,53,47,0.09)] bg-[#fbfbfa] p-2.5">
                {w.shifts.length === 0 && <div className="py-3 text-center text-[12px] text-[#787774]">Sin turnos esta semana</div>}
                {w.shifts.map(shift => (
                  <ShiftLine key={shift.id} shift={shift} radius={radius} onOpen={() => onOpenShift({ kind: 'edit', shift, memberName: w.member.name })} />
                ))}
                {w.overtimeSeconds > 0 && (
                  <div className="flex justify-between rounded-lg bg-white px-3 py-2 text-[12px] text-[#37352f]">
                    <span>Regular {hoursDecimal(w.regularSeconds)} h · {money(w.regularPay)}</span>
                    <span className="font-semibold text-[#9a4a0b]">Extra {hoursDecimal(w.overtimeSeconds)} h · {money(w.overtimePay)}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onOpenShift({ kind: 'create', memberId: w.member.id, memberName: w.member.name, date: isCurrent ? undefined : sheet.start })}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[rgba(55,53,47,0.25)] py-2 text-[13px] font-semibold text-[#37352f] hover:bg-white"
                >
                  <Plus className="h-4 w-4" />
                  Agregar turno a {w.member.name.split(' ')[0]}
                </button>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
