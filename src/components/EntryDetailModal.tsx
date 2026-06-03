'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Clock, Briefcase, Car, Wrench, DollarSign, Pencil,
  AlertTriangle, BadgeCheck, ChevronRight, Trash2, CalendarDays,
  FileText, History, Save
} from 'lucide-react'
import {
  formatCurrency, formatDuration, formatShortDateFlorida,
  formatTimeInFlorida, getFloridaDateComponents
} from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModalEntry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
  jobNumber?: string | null
  vehicle?: string | null
  serviceType?: string | null
  observation?: string | null
  calculatedAmount?: number | null
  paidAmount?: number | null
  companyPaid?: number | null
  correctionPending?: boolean
  correctionNote?: string | null
  correctionResolved?: boolean
  correctionResolvedNote?: string | null
  updatedAt?: string | null
  createdAt?: string | null
}

interface EntryDetailModalProps {
  readonly entry: ModalEntry
  readonly hourlyRate?: number
  readonly onClose: () => void
  readonly onUpdate: () => void
}

type ActiveTab = 'detail' | 'corrections'

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowLabel(): string {
  const now = new Date()
  return now.toLocaleDateString('es-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function parseTimestampFromNote(note: string | null | undefined): { ts: string; text: string } | null {
  if (!note) return null
  const re = /^\[([^\]]+)\]\s*(.*)$/s
  const match = re.exec(note)
  if (match) return { ts: match[1], text: match[2].trim() }
  return { ts: '', text: note.trim() }
}

function getDiffColorClass(d: number | null): string {
  if (d === null) return ''
  return d >= 0 ? 'text-green-600' : 'text-red-600'
}

function statusBadge(pending: boolean, resolved: boolean) {
  if (pending && !resolved) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-300">
        <AlertTriangle className="h-3 w-3" /> CORRECCIÓN PENDIENTE
      </span>
    )
  }
  if (resolved) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-300">
        <BadgeCheck className="h-3 w-3" /> CORREGIDO
      </span>
    )
  }
  return null
}

// ── Detail Tab Sub-components ─────────────────────────────────────────────────

interface TimeSectionProps {
  readonly entry: ModalEntry
  readonly editing: boolean
  readonly editDate: string
  readonly editStart: string
  readonly editEnd: string
  readonly onDateChange: (v: string) => void
  readonly onStartChange: (v: string) => void
  readonly onEndChange: (v: string) => void
}

function TimeSection({ entry, editing, editDate, editStart, editEnd, onDateChange, onStartChange, onEndChange }: TimeSectionProps) {
  const ic = 'mt-0.5 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-900'
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white">
        <Clock className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tiempo</span>
      </div>
      {editing ? (
        <div className="p-3 space-y-2">
          <div>
            <label htmlFor="edit-date" className="text-[11px] text-gray-500">Fecha</label>
            <input id="edit-date" type="date" value={editDate} onChange={e => onDateChange(e.target.value)} className={ic} style={{ fontSize: '16px' }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="edit-start" className="text-[11px] text-gray-500">Inicio</label>
              <input
                id="edit-start"
                type="text"
                inputMode="numeric"
                placeholder="HH:MM"
                value={editStart}
                onChange={e => {
                  let v = e.target.value.replaceAll(/[^0-9:]/g, '')
                  if (v.length === 2 && !v.includes(':')) v += ':'
                  if (v.length <= 5) onStartChange(v)
                }}
                className={`${ic} text-center`}
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <label htmlFor="edit-end" className="text-[11px] text-gray-500">Fin</label>
              <input
                id="edit-end"
                type="text"
                inputMode="numeric"
                placeholder="HH:MM"
                value={editEnd}
                onChange={e => {
                  let v = e.target.value.replaceAll(/[^0-9:]/g, '')
                  if (v.length === 2 && !v.includes(':')) v += ':'
                  if (v.length <= 5) onEndChange(v)
                }}
                className={`${ic} text-center`}
                style={{ fontSize: '16px' }}
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
  readonly entry: ModalEntry
  readonly editing: boolean
  readonly jobNumber: string
  readonly vehicle: string
  readonly serviceType: string
  readonly onJobChange: (v: string) => void
  readonly onVehicleChange: (v: string) => void
  readonly onServiceChange: (v: string) => void
}

function JobSection({ entry, editing, jobNumber, vehicle, serviceType, onJobChange, onVehicleChange, onServiceChange }: JobSectionProps) {
  const sc = 'mt-0.5 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-900'
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
              <label htmlFor="edit-job" className="text-[11px] text-gray-500">N° Trabajo</label>
              <input id="edit-job" type="text" inputMode="numeric" value={jobNumber} onChange={e => onJobChange(e.target.value)} placeholder="123456" className={sc} style={{ fontSize: '16px' }} />
            </div>
            <div>
              <label htmlFor="edit-vehicle" className="text-[11px] text-gray-500">Vehículo</label>
              <select id="edit-vehicle" value={vehicle} onChange={e => onVehicleChange(e.target.value)} className={sc} style={{ fontSize: '16px' }}>
                <option value="">Ninguno</option>
                <option value="sprinter">Sprinter</option>
                <option value="mini-bus">Mini Bus</option>
                <option value="motorcoach">Motorcoach</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="edit-service" className="text-[11px] text-gray-500">Tipo de servicio</label>
            <select id="edit-service" value={serviceType} onChange={e => onServiceChange(e.target.value)} className={sc} style={{ fontSize: '16px' }}>
              <option value="">Sin especificar</option>
              <option value="point-to-point">P2P (Point to Point)</option>
              <option value="hourly">Hourly</option>
            </select>
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
              <div className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-0.5"><Car className="h-2.5 w-2.5" />Vehículo</div>
              <div className="text-sm font-semibold text-gray-700 capitalize">{entry.vehicle}</div>
            </div>
          )}
          {entry.serviceType && (
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-0.5"><Wrench className="h-2.5 w-2.5" />Servicio</div>
              <div className="text-sm font-semibold text-gray-700">{entry.serviceType === 'point-to-point' ? 'P2P' : 'Hourly'}</div>
            </div>
          )}
          {!entry.jobNumber && !entry.vehicle && !entry.serviceType && (
            <span className="text-xs text-gray-400 italic">Sin información de trabajo</span>
          )}
        </div>
      )}
    </div>
  )
}

interface AmountSectionProps {
  readonly entry: ModalEntry
  readonly calc: number
  readonly editing: boolean
  readonly customAmount: string
  readonly paidAmount: string
  readonly onAmountChange: (v: string) => void
  readonly onPaidChange: (v: string) => void
}

function AmountSection({ entry, calc, editing, customAmount, paidAmount, onAmountChange, onPaidChange }: AmountSectionProps) {
  const companyPaid = entry.companyPaid ?? null
  const hasCompanyPaid = companyPaid !== null
  const diff = hasCompanyPaid ? companyPaid - calc : null
  const diffClass = getDiffColorClass(diff)
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white">
        <DollarSign className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Montos</span>
      </div>
      {editing ? (
        <div className="p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-calc" className="text-[11px] text-gray-500">Calculado ($)</label>
              <input id="edit-calc" type="number" inputMode="decimal" step="0.01" value={customAmount} onChange={e => onAmountChange(e.target.value)} className="mt-0.5 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 text-right font-semibold" style={{ fontSize: '16px' }} />
            </div>
            <div>
              <label htmlFor="edit-paid" className="text-[11px] text-gray-500">Pagado ($)</label>
              <input id="edit-paid" type="number" inputMode="decimal" step="0.01" value={paidAmount} onChange={e => onPaidChange(e.target.value)} placeholder="0.00" className="mt-0.5 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 text-right" style={{ fontSize: '16px' }} />
            </div>
          </div>
          {paidAmount && Number.parseFloat(paidAmount) > 0 && (
            <div className={`mt-2 text-center py-2 rounded-lg text-sm font-bold ${Number.parseFloat(paidAmount) >= Number.parseFloat(customAmount) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {Number.parseFloat(paidAmount) >= Number.parseFloat(customAmount) ? '+' : ''}
              {formatCurrency(Number.parseFloat(paidAmount) - Number.parseFloat(customAmount))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="px-3 py-2.5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Calculado</div>
            <div className="text-sm font-bold text-gray-800 mt-0.5">{formatCurrency(calc)}</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Pagado</div>
            <div className="text-sm font-semibold text-gray-600 mt-0.5">
              {entry.paidAmount == null ? <span className="text-gray-300">—</span> : formatCurrency(entry.paidAmount)}
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Empresa</div>
            {hasCompanyPaid && companyPaid !== null ? (
              <div>
                <div className="text-sm font-bold text-emerald-700 mt-0.5">{formatCurrency(companyPaid)}</div>
                {diff !== null && diff !== 0 && (
                  <div className={`text-[11px] font-semibold ${diffClass}`}>
                    {diff > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(diff))}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-gray-300 text-sm">—</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface ObsSectionProps {
  readonly entry: ModalEntry
  readonly editing: boolean
  readonly observation: string
  readonly isOpen: boolean
  readonly sheetValue: string
  readonly noteRef: React.RefObject<HTMLTextAreaElement>
  readonly onTrigger: () => void
  readonly onSheetValueChange: (v: string) => void
  readonly onCommit: () => void
}

function ObsSection({ entry, editing, observation, isOpen, sheetValue, noteRef, onTrigger, onSheetValueChange, onCommit }: ObsSectionProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white">
        <FileText className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nota</span>
      </div>
      {editing ? (
        <div className="p-3">
          <button type="button" onClick={onTrigger} className="w-full min-h-[52px] px-3 py-2 text-left text-sm bg-white border border-gray-200 rounded-lg text-gray-700 touch-manipulation">
            {observation ? <span className="line-clamp-3">{observation}</span> : <span className="text-gray-400 italic">Toca para agregar nota...</span>}
          </button>
          {isOpen && (
            <dialog open className="fixed inset-0 z-[60] flex flex-col justify-end w-full h-full max-w-none max-h-none m-0 p-0 bg-transparent border-0" aria-label="Editor de nota">
              <button type="button" aria-label="Cerrar nota" className="absolute inset-0 bg-black/40 cursor-default" onClick={onCommit} />
              <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col">
                <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                  <span className="text-[15px] font-semibold text-gray-900">Nota del trabajo</span>
                  <button type="button" onClick={onCommit} className="px-4 py-2 font-semibold text-sm bg-gray-900 text-white rounded-lg">Listo</button>
                </div>
                <textarea ref={noteRef} value={sheetValue} onChange={e => onSheetValueChange(e.target.value)} placeholder="Escribe tu nota aquí..." className="flex-1 w-full px-4 py-3 text-base text-gray-900 placeholder-gray-300 resize-none focus:outline-none" style={{ minHeight: '180px', fontSize: '16px' }} />
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-400">{sheetValue.length} caracteres</span>
                  {sheetValue && <button type="button" onClick={() => onSheetValueChange('')} className="text-xs text-red-500">Borrar nota</button>}
                </div>
              </div>
            </dialog>
          )}
        </div>
      ) : (
        <div className="px-3 py-2.5">
          {entry.observation ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.observation}</p> : <p className="text-xs text-gray-400 italic">Sin nota</p>}
        </div>
      )}
    </div>
  )
}

interface DetailActionsProps {
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

function DetailActions({ editing, saving, deleting, confirmDelete, onSave, onCancelEdit, onEdit, onDeleteRequest, onDeleteConfirm, onDeleteCancel }: DetailActionsProps) {
  return (
    <div className="flex items-center gap-2 pt-1">
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

// ── Detail Tab ────────────────────────────────────────────────────────────────

interface DetailTabProps {
  readonly entry: ModalEntry
  readonly hourlyRate: number
  readonly onUpdate: () => void
  readonly onClose: () => void
}

function DetailTab({ entry, hourlyRate, onUpdate, onClose }: DetailTabProps) {
  const calc = entry.calculatedAmount ?? ((entry.duration ?? 0) / 3600) * hourlyRate

  // edit mode
  const [editing, setEditing] = useState(false)
  const [jobNumber, setJobNumber] = useState(entry.jobNumber ?? '')
  const [vehicle, setVehicle] = useState(entry.vehicle ?? '')
  const [serviceType, setServiceType] = useState(entry.serviceType ?? '')
  const [customAmount, setCustomAmount] = useState(calc.toFixed(2))
  const [paidAmount, setPaidAmount] = useState(entry.paidAmount?.toString() ?? '')
  const [observation, setObservation] = useState(entry.observation ?? '')
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
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [noteSheetOpen, setNoteSheetOpen] = useState(false)
  const [noteSheetValue, setNoteSheetValue] = useState('')
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (noteSheetOpen && noteRef.current) noteRef.current.focus()
  }, [noteSheetOpen])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Compute new times
      const [y, mo, d] = editDate.split('-').map(Number)
      const [sH, sM] = editStart.split(':').map(Number)
      const [eH, eM] = editEnd.split(':').map(Number)
      const newStart = new Date(y, mo - 1, d, sH, sM, 0)
      const newEnd = new Date(y, mo - 1, d, eH, eM, 0)
      if (newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1)

      const res = await fetch(`/api/entries?id=${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobNumber: jobNumber || null,
          vehicle: vehicle || null,
          serviceType: serviceType || null,
          observation: observation || null,
          paidAmount: paidAmount ? Number.parseFloat(paidAmount) : null,
          calculatedAmount: customAmount ? Number.parseFloat(customAmount) : undefined,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEditing(false)
        onUpdate()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await fetch(`/api/entries?id=${entry.id}`, { method: 'DELETE' })
      onUpdate()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const openNote = () => { setNoteSheetValue(observation); setNoteSheetOpen(true) }
  const commitNote = () => { setObservation(noteSheetValue); setNoteSheetOpen(false) }

  return (
    <div className="space-y-4">
      <TimeSection entry={entry} editing={editing} editDate={editDate} editStart={editStart} editEnd={editEnd} onDateChange={setEditDate} onStartChange={setEditStart} onEndChange={setEditEnd} />
      <JobSection entry={entry} editing={editing} jobNumber={jobNumber} vehicle={vehicle} serviceType={serviceType} onJobChange={setJobNumber} onVehicleChange={setVehicle} onServiceChange={setServiceType} />
      <AmountSection entry={entry} calc={calc} editing={editing} customAmount={customAmount} paidAmount={paidAmount} onAmountChange={setCustomAmount} onPaidChange={setPaidAmount} />
      <ObsSection entry={entry} editing={editing} observation={observation} isOpen={noteSheetOpen} sheetValue={noteSheetValue} noteRef={noteRef} onTrigger={openNote} onSheetValueChange={setNoteSheetValue} onCommit={commitNote} />
      <DetailActions editing={editing} saving={saving} deleting={deleting} confirmDelete={confirmDelete} onSave={handleSave} onCancelEdit={() => setEditing(false)} onEdit={() => setEditing(true)} onDeleteRequest={() => setConfirmDelete(true)} onDeleteConfirm={handleDelete} onDeleteCancel={() => setConfirmDelete(false)} />
    </div>
  )
}

// ── Corrections Tab ───────────────────────────────────────────────────────────

interface CorrectionsTabProps {
  readonly entry: ModalEntry
  readonly onUpdate: () => void
}

type CorrectionStep = 'idle' | 'marking' | 'resolving'

function CorrectionsTab({ entry, onUpdate }: CorrectionsTabProps) {
  const isPending = !!(entry.correctionPending && !entry.correctionResolved)
  const isResolved = !!entry.correctionResolved
  const hasCorrectionNote = !!entry.correctionNote
  const hasResolvedNote = !!entry.correctionResolvedNote

  const pendingParsed = parseTimestampFromNote(entry.correctionNote)
  const resolvedParsed = parseTimestampFromNote(entry.correctionResolvedNote)

  const [step, setStep] = useState<CorrectionStep>('idle')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const saveCorrection = async (
    pending: boolean,
    corrNote: string | null,
    resolved: boolean,
    resNote: string | null
  ) => {
    setSaving(true)
    try {
      await fetch('/api/entries/correction', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: entry.id,
          correctionPending: pending,
          correctionNote: corrNote,
          correctionResolved: resolved,
          correctionResolvedNote: resNote,
        }),
      })
      setStep('idle')
      setNote('')
      onUpdate()
    } finally {
      setSaving(false)
    }
  }

  const handleMarkPending = async () => {
    const stamp = nowLabel()
    const fullNote = note.trim() ? `[${stamp}] ${note.trim()}` : `[${stamp}]`
    await saveCorrection(true, fullNote, false, null)
  }

  const handleMarkResolved = async () => {
    const stamp = nowLabel()
    const fullNote = note.trim() ? `[${stamp}] ${note.trim()}` : `[${stamp}]`
    await saveCorrection(false, entry.correctionNote ?? null, true, fullNote)
  }

  const handleUndo = async () => {
    await saveCorrection(false, null, false, null)
  }

  return (
    <div className="space-y-4">
      {/* ── Current status ── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white">
          <History className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Estado actual</span>
        </div>
        <div className="px-3 py-3">
          {!isPending && !isResolved && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
              <span className="text-sm text-gray-500">Sin correcciones pendientes</span>
            </div>
          )}
          {isPending && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 animate-pulse" />
              <span className="text-sm font-semibold text-orange-700">Corrección pendiente</span>
            </div>
          )}
          {isResolved && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-blue-700">Corregido</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Timeline ── */}
      {(hasCorrectionNote || hasResolvedNote) && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white">
            <History className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Historial</span>
          </div>
          <div className="px-3 py-3">
            <ol className="relative border-l-2 border-gray-200 pl-4 space-y-4 ml-1">
              {/* Correction event */}
              {hasCorrectionNote && pendingParsed && (
                <li className="relative">
                  <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-orange-400 border-2 border-white shadow" />
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="h-3 w-3 text-orange-600 flex-shrink-0" />
                      <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wide">Corrección marcada</span>
                    </div>
                    {pendingParsed.ts && (
                      <div className="text-[10px] text-orange-500 mb-1">{pendingParsed.ts}</div>
                    )}
                    {pendingParsed.text && (
                      <p className="text-xs text-orange-800 italic">&ldquo;{pendingParsed.text}&rdquo;</p>
                    )}
                  </div>
                </li>
              )}
              {/* Resolution event */}
              {hasResolvedNote && resolvedParsed && (
                <li className="relative">
                  <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <BadgeCheck className="h-3 w-3 text-blue-600 flex-shrink-0" />
                      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Corregido</span>
                    </div>
                    {resolvedParsed.ts && (
                      <div className="text-[10px] text-blue-500 mb-1">{resolvedParsed.ts}</div>
                    )}
                    {resolvedParsed.text && (
                      <p className="text-xs text-blue-800 italic">&ldquo;{resolvedParsed.text}&rdquo;</p>
                    )}
                  </div>
                </li>
              )}
            </ol>
          </div>
        </div>
      )}

      {/* ── Action panels ── */}
      {step === 'idle' && (
        <div className="space-y-2">
          {!isPending && !isResolved && (
            <button
              type="button"
              onClick={() => { setNote(''); setStep('marking') }}
              className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm font-semibold text-orange-700 hover:bg-orange-100 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Marcar corrección pendiente
              </div>
              <ChevronRight className="h-4 w-4 opacity-60" />
            </button>
          )}
          {isPending && (
            <>
              <button
                type="button"
                onClick={() => { setNote(''); setStep('resolving') }}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-semibold text-blue-700 hover:bg-blue-100 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4" />
                  Marcar como corregido
                </div>
                <ChevronRight className="h-4 w-4 opacity-60" />
              </button>
              <button
                type="button"
                onClick={handleUndo}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-all"
              >
                <X className="h-3.5 w-3.5" />
                Quitar corrección pendiente
              </button>
            </>
          )}
          {isResolved && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-all"
            >
              <X className="h-3.5 w-3.5" />
              Deshacer corrección
            </button>
          )}
        </div>
      )}

      {step === 'marking' && (
        <CorrectionForm
          title="¿Por qué necesita corrección?"
          placeholder="Ej: El monto recibido no coincide, falta $X..."
          color="orange"
          note={note}
          saving={saving}
          onNoteChange={setNote}
          onCancel={() => setStep('idle')}
          onConfirm={handleMarkPending}
          confirmLabel="Marcar pendiente"
        />
      )}

      {step === 'resolving' && (
        <CorrectionForm
          title="¿Cómo y cuándo fue corregido?"
          placeholder="Ej: Lo pusieron en la semana 18, pago del viernes..."
          color="blue"
          note={note}
          saving={saving}
          onNoteChange={setNote}
          onCancel={() => setStep('idle')}
          onConfirm={handleMarkResolved}
          confirmLabel="Confirmar corregido"
        />
      )}
    </div>
  )
}

interface CorrectionFormProps {
  readonly title: string
  readonly placeholder: string
  readonly color: 'orange' | 'blue'
  readonly note: string
  readonly saving: boolean
  readonly onNoteChange: (v: string) => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
  readonly confirmLabel: string
}

function CorrectionForm({ title, placeholder, color, note, saving, onNoteChange, onCancel, onConfirm, confirmLabel }: CorrectionFormProps) {
  const base = color === 'orange'
    ? { wrap: 'bg-orange-50 border-orange-300', label: 'text-orange-800', textarea: 'border-orange-200 focus:ring-orange-400', btn: 'bg-orange-500 hover:bg-orange-600' }
    : { wrap: 'bg-blue-50 border-blue-300', label: 'text-blue-800', textarea: 'border-blue-200 focus:ring-blue-400', btn: 'bg-blue-500 hover:bg-blue-600' }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${base.wrap}`}>
      <p className={`text-sm font-semibold ${base.label}`}>{title}</p>
      <textarea
        rows={3}
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full text-sm border rounded-xl p-3 resize-none focus:outline-none focus:ring-1 bg-white ${base.textarea}`}
        style={{ fontSize: '16px' }}
      />
      <div className="text-[11px] text-gray-400">
        Se registrará automáticamente la fecha y hora actual.
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className={`text-xs px-4 py-2 rounded-xl text-white font-bold transition-all ${base.btn} disabled:opacity-50`}
        >
          {saving ? 'Guardando...' : confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function EntryDetailModal({ entry, hourlyRate = 25, onClose, onUpdate }: EntryDetailModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('detail')
  const [mounted, setMounted] = useState(false)
  // Refresh local copy on update
  const [localEntry, setLocalEntry] = useState<ModalEntry>(entry)

  useEffect(() => { setMounted(true) }, [])

  const handleUpdate = async () => {
    // Refresh entry data from server
    try {
      const res = await fetch(`/api/entries?id=${localEntry.id}`)
      const data = await res.json()
      if (data.success && data.data?.length) {
        setLocalEntry(data.data[0] as ModalEntry)
      }
    } catch { /* ignore */ }
    onUpdate()
  }

  const isPending = !!(localEntry.correctionPending && !localEntry.correctionResolved)
  const isResolved = !!localEntry.correctionResolved
  const calc = localEntry.calculatedAmount ?? ((localEntry.duration ?? 0) / 3600) * hourlyRate
  const resolvedBadge = isResolved ? '✓' : undefined
  const corrBadge = isPending ? 'pendiente' : resolvedBadge

  if (!mounted) return null

  return createPortal(
    <dialog
      open
      aria-label="Detalle de entrada"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center w-full h-full max-w-none max-h-none m-0 p-0 bg-transparent border-0"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88dvh]">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-2 pb-3 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-gray-900">
                {localEntry.jobNumber ? `Trabajo #${localEntry.jobNumber}` : 'Entrada'}
              </h2>
              {statusBadge(isPending, isResolved)}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">{formatShortDateFlorida(localEntry.date)}</span>
              {!!localEntry.duration && (
                <span className="text-xs text-gray-500">{formatDuration(localEntry.duration)}</span>
              )}
              <span className="text-xs font-bold text-emerald-600">{formatCurrency(calc)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 gap-0">
          <TabButton
            active={activeTab === 'detail'}
            onClick={() => setActiveTab('detail')}
            icon={<Briefcase className="h-3.5 w-3.5" />}
            label="Detalle"
          />
          <TabButton
            active={activeTab === 'corrections'}
            onClick={() => setActiveTab('corrections')}
            icon={<History className="h-3.5 w-3.5" />}
            label="Correcciones"
            badge={corrBadge}
          />
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeTab === 'detail' && (
            <DetailTab
              entry={localEntry}
              hourlyRate={hourlyRate}
              onUpdate={handleUpdate}
              onClose={onClose}
            />
          )}
          {activeTab === 'corrections' && (
            <CorrectionsTab
              entry={localEntry}
              onUpdate={handleUpdate}
            />
          )}
        </div>
      </div>
    </dialog>,
    document.body
  )
}

interface TabButtonProps {
  readonly active: boolean
  readonly onClick: () => void
  readonly icon: React.ReactNode
  readonly label: string
  readonly badge?: string
}

function TabButton({ active, onClick, icon, label, badge }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all ${
        active
          ? 'border-gray-900 text-gray-900'
          : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon}
      {label}
      {badge && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
          badge === '✓'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-orange-100 text-orange-700'
        }`}>
          {badge}
        </span>
      )}
    </button>
  )
}

// Re-export for use in search
export type { ModalEntry as SearchEntry }
