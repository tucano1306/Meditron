'use client'

import { useState, type FormEvent } from 'react'
import { AlertTriangle, Loader2, Pencil, UserRound } from 'lucide-react'
import { MAX_PROFILE_FIELD, needsFullName, reportIdentity } from '@/lib/report-identity'

// Cómo aparece la persona en el reporte que recibe nómina: "Leonardo Canepa /
// Venecoro". Si solo tiene un nombre ("Leo") se avisa, porque en la compañía
// puede haber varios con el mismo nombre.

export interface ReportProfile {
  name: string | null
  businessName: string | null
}

interface ReportIdentityEditorProps {
  readonly email: string
  readonly profile: ReportProfile
  readonly onSaved: (profile: ReportProfile) => void
}

export function ReportIdentityEditor({ email, profile, onSaved }: ReportIdentityEditorProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [business, setBusiness] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const identity = reportIdentity({ email, ...profile })
  const incomplete = needsFullName(profile.name)

  const startEditing = () => {
    setName(profile.name ?? '')
    setBusiness(profile.businessName ?? '')
    setError(null)
    setEditing(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Escribe tu nombre y apellido')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, businessName: business }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'No se pudo guardar')
        return
      }
      onSaved(json.data)
      setEditing(false)
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    const preview = name.trim() ? reportIdentity({ email, name, businessName: business }).label : null
    const inputClass = 'w-full rounded-lg border border-[rgba(55,53,47,0.16)] px-3 py-2 text-[#37352f] placeholder:text-[#b4b4b0] focus:border-[#37352f] focus:outline-none'
    return (
      <form onSubmit={save} className="mt-4 rounded-lg border border-[rgba(55,53,47,0.12)] bg-[rgba(55,53,47,0.02)] p-3 animate-fade-in">
        <div className="text-[13px] font-semibold text-[#37352f]">Tu nombre en el reporte</div>
        <p className="mt-0.5 text-[12px] text-[#787774]">Así te identifican en nómina o recursos humanos.</p>

        <label htmlFor="report-name" className="mt-3 block text-[12px] font-semibold text-[#37352f]">Nombre y apellido</label>
        <input
          id="report-name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          value={name}
          maxLength={MAX_PROFILE_FIELD}
          onChange={e => { setName(e.target.value); setError(null) }}
          placeholder="Ej. María Pérez"
          className={`mt-1 ${inputClass}`}
          style={{ fontSize: '16px' }}
        />
        {name.trim() && needsFullName(name) && (
          <div className="mt-1 text-[12px] text-amber-700">Agrega tu apellido para que no te confundan con otra persona.</div>
        )}

        <label htmlFor="report-business" className="mt-3 block text-[12px] font-semibold text-[#37352f]">
          Tu empresa <span className="font-normal text-[#9b9a97]">(opcional)</span>
        </label>
        <input
          id="report-business"
          type="text"
          autoComplete="organization"
          autoCapitalize="words"
          value={business}
          maxLength={MAX_PROFILE_FIELD}
          onChange={e => setBusiness(e.target.value)}
          placeholder="Ej. Pérez Transport LLC"
          className={`mt-1 ${inputClass}`}
          style={{ fontSize: '16px' }}
        />
        <div className="mt-1 text-[12px] text-[#9b9a97]">Si cobras a través de tu propia empresa o LLC.</div>

        {preview && (
          <div className="mt-3 rounded-md bg-white px-3 py-2 text-[12px] text-[#787774] ring-1 ring-[rgba(55,53,47,0.09)]">
            Se verá así: <span className="font-semibold text-[#37352f] break-words">{preview}</span>
          </div>
        )}
        {error && <div className="mt-2 text-[12px] text-red-600">{error}</div>}

        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#37352f] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#2f2d28] disabled:opacity-60 transition-colors touch-manipulation"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="rounded-lg px-3 py-2 text-[13px] font-semibold text-[#787774] hover:bg-[rgba(55,53,47,0.06)] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  // Solo un nombre: aviso para completarlo antes de enviar
  if (incomplete) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <div className="min-w-0">
            En el reporte apareces solo como <strong className="break-words">“{identity.label}”</strong>. Escribe tu nombre completo para que en nómina sepan que es tuyo.
          </div>
        </div>
        <button
          type="button"
          onClick={startEditing}
          className="mt-2 ml-[22px] inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100 transition-colors touch-manipulation"
        >
          <Pencil className="h-3 w-3" />
          Escribir mi nombre completo
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-[rgba(55,53,47,0.04)] px-3 py-2">
      <UserRound className="h-4 w-4 flex-shrink-0 text-[#787774]" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-[#787774]">Tu nombre en el reporte</div>
        <div className="truncate text-[13px] font-semibold text-[#37352f]" title={identity.label}>{identity.label}</div>
      </div>
      <button
        type="button"
        onClick={startEditing}
        className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#787774] hover:bg-white hover:text-[#37352f] transition-colors touch-manipulation"
      >
        <Pencil className="h-3 w-3" />
        Cambiar
      </button>
    </div>
  )
}
