'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Clock, Briefcase, Car, DollarSign, Pencil, Trash2,
  CalendarDays, Save, TrendingUp, TrendingDown
} from 'lucide-react'
import {
  formatCurrency, formatDuration, formatShortDateFlorida,
  formatTimeInFlorida, getFloridaDateComponents
} from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaymentEntryData {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
  jobNumber?: string | null
  vehicle?: string | null
  amount?: number | null
  hourlyRate?: number | null
  companyPaid?: number | null
}

interface PaymentEntryModalProps {
  readonly entry: PaymentEntryData
  readonly onClose: () => void
  readonly onUpdate: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VEHICLE_LABELS: Record<string, string> = {
  sprinter: 'Sprinter',
  'mini-bus': 'Mini Bus',
  motorcoach: 'Motorcoach',
}

function getDiffClass(d: number | null) {
  if (d == null) return ''
  return d >= 0 ? 'text-green-600' : 'text-red-600'
}

const IC = 'mt-0.5 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-900'

// ── Sub-components ────────────────────────────────────────────────────────────

interface TimeSectionProps {
  readonly entry: PaymentEntryData
  readonly editing: boolean
  readonly editDate: string
  readonly editStart: string
  readonly editEnd: string
  readonly onDateChange: (v: string) => void
  readonly onStartChange: (v: string) => void
  readonly onEndChange: (v: string) => void
}

function PmTimeSection({ entry, editing, editDate, editStart, editEnd, onDateChange, onStartChange, onEndChange }: TimeSectionProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white">
        <Clock className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tiempo</span>
      </div>
      {editing ? (
        <div className="p-3 space-y-2">
          <div>
            <label htmlFor="pe-date" className="text-[11px] text-gray-500">Fecha</label>
            <input id="pe-date" type="date" value={editDate} onChange={e => onDateChange(e.target.value)} className={IC} style={{ fontSize: '16px' }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="pe-start" className="text-[11px] text-gray-500">Inicio</label>
              <input
                id="pe-start" type="text" inputMode="numeric" placeholder="HH:MM" value={editStart}
                onChange={e => {
                  let v = e.target.value.replaceAll(/[^0-9:]/g, '')
                  if (v.length === 2 && !v.includes(':')) v += ':'
                  if (v.length <= 5) onStartChange(v)
                }}
                className={`${IC} text-center`} style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <label htmlFor="pe-end" className="text-[11px] text-gray-500">Fin</label>
              <input
                id="pe-end" type="text" inputMode="numeric" placeholder="HH:MM" value={editEnd}
                onChange={e => {
                  let v = e.target.value.replaceAll(/[^0-9:]/g, '')
                  if (v.length === 2 && !v.includes(':')) v += ':'
                  if (v.length <= 5) onEndChange(v)
                }}
                className={`${IC} text-center`} style={{ fontSize: '16px' }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2.5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <CalendarDays className="h-3 w-3" />
              {formatShortDateFlorida(entry.date)}
            </div>
            <div className="text-sm font-semibold text-gray-800 mt-0.5">
              {formatTimeInFlorida(entry.startTime)}
              <span className="text-gray-400 mx-1.5">→</span>
              {entry.endTime ? formatTimeInFlorida(entry.endTime) : <span className="text-gray-400 animate-pulse">En curso</span>}
            </div>
          </div>
          {!!entry.duration && (
            <div className="text-right">
              <div className="text-xs text-gray-400">Duración</div>
              <div className="text-sm font-bold text-gray-800">{formatDuration(entry.duration)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface JobSectionProps {
  readonly entry: PaymentEntryData
  readonly editing: boolean
  readonly jobNumber: string
  readonly vehicle: string
  readonly onJobChange: (v: string) => void
  readonly onVehicleChange: (v: string) => void
}

function PmJobSection({ entry, editing, jobNumber, vehicle, onJobChange, onVehicleChange }: JobSectionProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white">
        <Briefcase className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Trabajo</span>
      </div>
      {editing ? (
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="pe-job" className="text-[11px] text-gray-500">N° Trabajo</label>
              <input id="pe-job" type="text" inputMode="numeric" value={jobNumber} onChange={e => onJobChange(e.target.value)} placeholder="123456" className={IC} style={{ fontSize: '16px' }} />
            </div>
            <div>
              <label htmlFor="pe-vehicle" className="text-[11px] text-gray-500">Vehículo</label>
              <select id="pe-vehicle" value={vehicle} onChange={e => onVehicleChange(e.target.value)} className={IC} style={{ fontSize: '16px' }}>
                <option value="">Ninguno</option>
                <option value="sprinter">Sprinter</option>
                <option value="mini-bus">Mini Bus</option>
                <option value="motorcoach">Motorcoach</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2.5 flex items-center gap-4 flex-wrap">
          {entry.jobNumber && (
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Trabajo</div>
              <div className="text-sm font-bold text-gray-900">#{entry.jobNumber}</div>
            </div>
          )}
          {entry.vehicle && (
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-0.5">
                <Car className="h-2.5 w-2.5" />Vehículo
              </div>
              <div className="text-sm font-semibold text-gray-700">
                {VEHICLE_LABELS[entry.vehicle] ?? entry.vehicle}
              </div>
            </div>
          )}
          {!entry.jobNumber && !entry.vehicle && (
            <span className="text-xs text-gray-400 italic">Sin información de trabajo</span>
          )}
        </div>
      )}
    </div>
  )
}

interface AmountSectionProps {
  readonly entry: PaymentEntryData
  readonly calc: number
  readonly paid: number | null
  readonly diff: number | null
  readonly editing: boolean
  readonly amount: string
  readonly companyPaid: string
  readonly onAmountChange: (v: string) => void
  readonly onCompanyPaidChange: (v: string) => void
}

function PmAmountSection({ entry, calc, paid, diff, editing, amount, companyPaid, onAmountChange, onCompanyPaidChange }: AmountSectionProps) {
  const diffClass = getDiffClass(diff)
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white">
        <DollarSign className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Montos</span>
      </div>
      {editing ? (
        <div className="p-3 space-y-2">
          <div>
            <label htmlFor="pe-amount" className="text-[11px] text-gray-500">Monto del trabajo ($)</label>
            <input id="pe-amount" type="number" inputMode="decimal" step="0.01" value={amount} onChange={e => onAmountChange(e.target.value)} className={`${IC} text-right font-semibold`} style={{ fontSize: '16px' }} />
          </div>
          <div>
            <label htmlFor="pe-company" className="text-[11px] text-gray-500">Pagado por Compañía ($)</label>
            <input id="pe-company" type="number" inputMode="decimal" step="0.01" value={companyPaid} onChange={e => onCompanyPaidChange(e.target.value)} placeholder="0.00" className={`${IC} text-right`} style={{ fontSize: '16px' }} />
          </div>
          {companyPaid && Number.parseFloat(companyPaid) > 0 && amount && (
            <div className={`text-center py-2 rounded-lg text-sm font-bold ${Number.parseFloat(companyPaid) >= Number.parseFloat(amount) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {Number.parseFloat(companyPaid) >= Number.parseFloat(amount) ? '+' : ''}
              {formatCurrency(Number.parseFloat(companyPaid) - Number.parseFloat(amount))}
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="px-3 py-2.5">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Facturado</div>
              <div className="text-sm font-bold text-gray-800 mt-0.5">{formatCurrency(calc)}</div>
              {!!entry.hourlyRate && (
                <div className="text-[10px] text-gray-400">{formatCurrency(entry.hourlyRate)}/h</div>
              )}
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Empresa</div>
              {paid == null ? (
                <span className="text-gray-300 text-sm">—</span>
              ) : (
                <>
                  <div className="text-sm font-bold text-emerald-700 mt-0.5">{formatCurrency(paid)}</div>
                  {diff != null && diff !== 0 && (
                    <div className={`text-[11px] font-semibold flex items-center gap-0.5 ${diffClass}`}>
                      {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {formatCurrency(Math.abs(diff))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {diff != null && (
            <div className={`px-3 py-2 flex items-center justify-between ${diff >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className="text-xs font-medium text-gray-600">Diferencia</span>
              <span className={`text-sm font-bold ${diffClass}`}>
                {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ActionsProps {
  readonly editing: boolean
  readonly saving: boolean
  readonly deleting: boolean
  readonly confirmDelete: boolean
  readonly onSave: () => void
  readonly onCancelEdit: () => void
  readonly onEdit: () => void
  readonly onDeleteRequest: () => void
  readonly onDeleteConfirm: () => void
  readonly onDeleteCancel: () => void
}

function PmActions({ editing, saving, deleting, confirmDelete, onSave, onCancelEdit, onEdit, onDeleteRequest, onDeleteConfirm, onDeleteCancel }: ActionsProps) {
  return (
    <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0 bg-white">
      {editing ? (
        <>
          <button type="button" onClick={onSave} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 active:scale-95 disabled:opacity-50 transition-all">
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button type="button" onClick={onCancelEdit} className="py-3 px-4 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-all">
            Cancelar
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 active:scale-95 transition-all">
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={onDeleteConfirm} disabled={deleting} className="py-3 px-3 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all">
                {deleting ? '...' : 'Confirmar'}
              </button>
              <button type="button" onClick={onDeleteCancel} className="py-3 px-3 bg-gray-100 text-gray-600 text-xs rounded-xl">No</button>
            </div>
          ) : (
            <button type="button" onClick={onDeleteRequest} className="py-3 px-4 bg-red-50 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-100 transition-all">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function PaymentEntryModal({ entry, onClose, onUpdate }: PaymentEntryModalProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [editDate, setEditDate] = useState(() => {
    const d = typeof entry.date === 'string' ? entry.date : new Date(entry.date).toISOString()
    return d.split('T')[0]
  })
  const [editStart, setEditStart] = useState(() => {
    const c = getFloridaDateComponents(new Date(entry.startTime))
    return `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`
  })
  const [editEnd, setEditEnd] = useState(() => {
    if (!entry.endTime) return ''
    const c = getFloridaDateComponents(new Date(entry.endTime))
    return `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`
  })
  const [jobNumber, setJobNumber] = useState(entry.jobNumber ?? '')
  const [vehicle, setVehicle] = useState(entry.vehicle ?? '')
  const [amount, setAmount] = useState(entry.amount?.toFixed(2) ?? '')
  const [companyPaid, setCompanyPaid] = useState(entry.companyPaid?.toString() ?? '')

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleSave = async () => {
    if (!editStart || !editEnd || !amount) return
    setSaving(true)
    try {
      const [y, mo, d] = editDate.split('-').map(Number)
      const [sH, sM] = editStart.split(':').map(Number)
      const [eH, eM] = editEnd.split(':').map(Number)
      const newStart = new Date(y, mo - 1, d, sH, sM, 0)
      const newEnd = new Date(y, mo - 1, d, eH, eM, 0)
      if (newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1)
      const res = await fetch(`/api/payment?id=${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: newStart.toISOString(), endTime: newEnd.toISOString(), amount: Number.parseFloat(amount), jobNumber: jobNumber || null, vehicle: vehicle || null }),
      })
      const data = await res.json()
      if (data.success) { setEditing(false); onUpdate() }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await fetch(`/api/payment?id=${entry.id}`, { method: 'DELETE' })
      onUpdate()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const calc = entry.amount ?? 0
  const paid = entry.companyPaid ?? null
  const diff = paid == null ? null : paid - calc

  if (!mounted) return null

  const modal = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Briefcase className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {entry.jobNumber ? `Trabajo #${entry.jobNumber}` : 'Detalle de trabajo'}
              </h2>
              <p className="text-[11px] text-gray-500">{formatShortDateFlorida(entry.date)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/60 transition-colors" aria-label="Cerrar">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
          <PmTimeSection entry={entry} editing={editing} editDate={editDate} editStart={editStart} editEnd={editEnd} onDateChange={setEditDate} onStartChange={setEditStart} onEndChange={setEditEnd} />
          <PmJobSection entry={entry} editing={editing} jobNumber={jobNumber} vehicle={vehicle} onJobChange={setJobNumber} onVehicleChange={setVehicle} />
          <PmAmountSection entry={entry} calc={calc} paid={paid} diff={diff} editing={editing} amount={amount} companyPaid={companyPaid} onAmountChange={setAmount} onCompanyPaidChange={setCompanyPaid} />
        </div>

        <PmActions editing={editing} saving={saving} deleting={deleting} confirmDelete={confirmDelete} onSave={handleSave} onCancelEdit={() => setEditing(false)} onEdit={() => setEditing(true)} onDeleteRequest={() => setConfirmDelete(true)} onDeleteConfirm={handleDelete} onDeleteCancel={() => setConfirmDelete(false)} />
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

