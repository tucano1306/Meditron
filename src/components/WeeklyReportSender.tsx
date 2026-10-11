'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FileText, Loader2, Mail, Send, Share2, X } from 'lucide-react'
import { addDaysToKey, type Company } from '@/lib/companies'
import { isEmail, MAX_REPORT_EMAILS } from '@/lib/company-input'
import { formatRange, formatHM } from '@/lib/display'
import { formatKeyShort, formatTime12, money } from '@/lib/report-format'
import { refreshCompanies } from '@/hooks/useCompanies'

// Envío por correo del PDF de una semana de pago con un solo botón. Los
// destinatarios se guardan en la compañía, así la próxima vez basta un toque.
// Sin correo configurado en el servidor, comparte el PDF desde el teléfono.

interface ReportStatus {
  configured: boolean
  recipients: string[]
  senderEmail: string
  lastCompletedStart: string
  currentStart: string
  week: {
    start: string
    end: string
    totalSeconds: number
    overtimeSeconds: number
    totalPay: number
    entryCount: number
    hasRunningEntry: boolean
    finished: boolean
  }
  deliveries: { sentAt: string; recipients: string[] }[]
}

interface WeeklyReportSenderProps {
  readonly company: Company
  /** banner: aviso de la última semana terminada sin enviar · card: cualquier semana */
  readonly variant: 'banner' | 'card'
  /** Semana a enviar (cualquier día de ella); sin ella la tarjeta deja elegir la semana */
  readonly date?: string
  readonly refreshTrigger?: number
}

type Phase = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; at: string; to: string[]; copiedTo: string | null } | { kind: 'error'; text: string }

function dismissKey(companyId: string, weekStart: string): string {
  return `meditron_report_dismissed_${companyId}_${weekStart}`
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function sentLabel(iso: string): string {
  const date = new Date(iso)
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date)
  return `${formatKeyShort(key)}, ${formatTime12(date)}`
}

/** Comparte el PDF (menú del teléfono) o, si no se puede, lo descarga y abre el correo */
async function sharePdf(company: Company, status: ReportStatus, recipients: string[]): Promise<void> {
  const url = `/api/reports/weekly-pdf?companyId=${encodeURIComponent(company.id)}&date=${status.week.start}&download=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo generar el PDF')
  const blob = await res.blob()
  const fileName = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'reporte-semanal.pdf'
  const subject = `Reporte semanal · ${company.name} · ${formatRange(status.week.start, status.week.end)} ${status.week.end.slice(0, 4)}`
  const text = `Adjunto el reporte semanal de ${company.name}: ${formatHM(status.week.totalSeconds)} · ${money(status.week.totalPay)}.`
  const file = new File([blob], fileName, { type: 'application/pdf' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: subject, text })
    return
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  link.click()
  URL.revokeObjectURL(link.href)
  globalThis.location.href = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${text}\n\n(Adjunta el PDF que se acaba de descargar: ${fileName})`)}`
}

export function WeeklyReportSender({ company, variant, date, refreshTrigger = 0 }: WeeklyReportSenderProps) {
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [loaded, setLoaded] = useState<{ key: string; status: ReportStatus | null } | null>(null)
  const [draft, setDraft] = useState<string[] | null>(null)
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [copyMe, setCopyMe] = useState(true)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  const targetDate = date ?? pickedDate
  const requestKey = `${company.id}|${targetDate ?? ''}|${refreshTrigger}|${reload}`

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ companyId: company.id })
    if (targetDate) params.set('date', targetDate)
    fetch(`/api/reports/weekly-email?${params}`)
      .then(res => res.json())
      .then(json => {
        if (!cancelled) setLoaded({ key: requestKey, status: json.success ? json.data : null })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: requestKey, status: null })
      })
    return () => { cancelled = true }
  }, [company.id, targetDate, requestKey])

  const status = loaded?.status ?? null
  const isLoading = loaded?.key !== requestKey
  if (!status) {
    if (variant === 'banner' || !isLoading) return null
    return <div className="h-40 rounded-xl border border-[rgba(55,53,47,0.09)] bg-white animate-pulse" />
  }

  const week = status.week
  const recipients = draft ?? status.recipients
  const alreadySent = status.deliveries.length > 0
  const justSent = phase.kind === 'sent'

  // El aviso solo aparece para la última semana terminada con horas y sin enviar
  if (variant === 'banner') {
    const hidden = dismissed || readDismissed(dismissKey(company.id, week.start))
    if (!justSent && (hidden || alreadySent || week.entryCount === 0)) return null
  }

  const addRecipient = (raw: string) => {
    const email = raw.trim().replace(/[,;]$/, '').toLowerCase()
    if (!email) return true
    if (!isEmail(email)) {
      setInputError('Revisa el correo')
      return false
    }
    if (recipients.includes(email)) {
      setInput('')
      return true
    }
    if (recipients.length >= MAX_REPORT_EMAILS) {
      setInputError(`Máximo ${MAX_REPORT_EMAILS} correos`)
      return false
    }
    setDraft([...recipients, email])
    setInput('')
    setInputError(null)
    return true
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault()
      addRecipient(input)
    } else if (e.key === 'Backspace' && !input && recipients.length > 0) {
      setDraft(recipients.slice(0, -1))
    }
  }

  const handleSend = async () => {
    // Lo que quedó escrito en el campo también cuenta como destinatario
    let to = recipients
    if (input.trim()) {
      if (!addRecipient(input)) return
      to = [...recipients, input.trim().toLowerCase()]
    }
    if (status.configured && to.length === 0) {
      setInputError('¿A qué correo lo enviamos?')
      return
    }
    setPhase({ kind: 'sending' })
    try {
      if (!status.configured) {
        await sharePdf(company, status, to)
        setPhase({ kind: 'idle' })
        return
      }
      const res = await fetch('/api/reports/weekly-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, date: week.start, to, copyMe }),
      })
      const json = await res.json()
      if (!json.success) {
        setPhase({ kind: 'error', text: json.error || 'No se pudo enviar' })
        return
      }
      setPhase({ kind: 'sent', at: json.data.sentAt, to: json.data.recipients, copiedTo: json.data.copiedTo })
      setDraft(null)
      refreshCompanies().catch(() => undefined)
    } catch (err) {
      // Cancelar el menú de compartir no es un error
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPhase({ kind: 'idle' })
        return
      }
      setPhase({ kind: 'error', text: err instanceof Error ? err.message : 'Error de conexión' })
    }
  }

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(company.id, week.start), '1')
    } catch { /* sin almacenamiento disponible */ }
    setDismissed(true)
  }

  const changeWeek = (delta: number) => {
    setPickedDate(addDaysToKey(week.start, 7 * delta))
    setPhase({ kind: 'idle' })
    setDraft(null)
    setInputError(null)
  }

  const pdfHref = `/api/reports/weekly-pdf?companyId=${encodeURIComponent(company.id)}&date=${week.start}`
  const title = `${formatRange(week.start, week.end)} ${week.end.slice(0, 4)}`
  const sending = phase.kind === 'sending'
  const canSend = week.entryCount > 0 && !sending
  const sendLabel = (() => {
    if (!status.configured) return 'Compartir PDF por correo'
    if (sending) return 'Enviando…'
    const verb = alreadySent || justSent ? 'Reenviar' : 'Enviar reporte'
    if (recipients.length === 1) return `${verb} a ${recipients[0]}`
    if (recipients.length > 1) return `${verb} a ${recipients.length} correos`
    return verb
  })()

  // ── Enviado ──
  if (phase.kind === 'sent') {
    return (
      <section className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5 animate-fade-in">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm animate-pop-in">
            <Check className="h-6 w-6" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-emerald-900">Reporte enviado</div>
            <div className="mt-0.5 text-[13px] text-emerald-800">
              Semana {title} a {phase.to.join(', ')}
              {phase.copiedTo && <> · copia a ti</>} · {formatTime12(new Date(phase.at))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={pdfHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors">
                <FileText className="h-3.5 w-3.5" />
                Ver PDF enviado
              </a>
              <button type="button" onClick={() => { setPhase({ kind: 'idle' }); setReload(r => r + 1) }} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors">
                Listo
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className={`relative overflow-hidden rounded-xl border bg-white p-4 sm:p-5 shadow-sm ${variant === 'banner' ? 'border-[rgba(55,53,47,0.12)] animate-card-in' : 'border-[rgba(55,53,47,0.09)]'}`}
    >
      {variant === 'banner' && <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: company.color }} />}

      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(55,53,47,0.06)] text-[#37352f]">
          <Mail className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {variant === 'banner' ? (
            <div className="text-[15px] font-bold text-[#37352f]">Semana {title} terminada</div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-[15px] font-bold text-[#37352f]">Reporte por correo</span>
            </div>
          )}
          <div className="mt-0.5 text-[13px] text-[#787774] tabular-nums">
            {variant === 'card' && date && `Semana ${title} · `}
            {week.entryCount > 0
              ? `${formatHM(week.totalSeconds)} · ${money(week.totalPay)} · ${week.entryCount} ${week.entryCount === 1 ? 'registro' : 'registros'}`
              : 'Sin horas registradas'}
          </div>
        </div>
        {variant === 'banner' && (
          <button type="button" onClick={dismiss} aria-label="Ahora no" title="Ahora no" className="rounded-lg p-1.5 text-[#9b9a97] hover:bg-[rgba(55,53,47,0.08)] hover:text-[#37352f] transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Semana (tarjeta sin semana fija) */}
      {variant === 'card' && !date && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-[rgba(55,53,47,0.04)] px-2 py-1.5">
          <button type="button" onClick={() => changeWeek(-1)} aria-label="Semana anterior" className="rounded-md p-1.5 text-[#787774] hover:bg-white hover:text-[#37352f] transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#37352f]">
            Semana {title}
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9b9a97]" />}
            {week.start === status.lastCompletedStart && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">ÚLTIMA TERMINADA</span>}
            {week.start === status.currentStart && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">EN CURSO</span>}
          </div>
          <button type="button" onClick={() => changeWeek(1)} disabled={week.start >= status.currentStart} aria-label="Semana siguiente" className="rounded-md p-1.5 text-[#787774] hover:bg-white hover:text-[#37352f] disabled:opacity-30 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Estado de la semana */}
      {alreadySent && variant === 'card' && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
          <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Enviado el {sentLabel(status.deliveries[0].sentAt)} a {status.deliveries[0].recipients.join(', ')}
            {status.deliveries.length > 1 && ` (${status.deliveries.length} envíos)`}
          </span>
        </div>
      )}
      {!week.finished && week.entryCount > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Esta semana aún no termina: el reporte saldrá con las horas registradas hasta ahora.
        </div>
      )}

      {week.entryCount > 0 && (
        <>
          {/* Destinatarios */}
          <div className="mt-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#787774]">Para</div>
            <div className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors focus-within:border-[#37352f] ${inputError ? 'border-red-300' : 'border-[rgba(55,53,47,0.16)]'}`}>
              {recipients.map(email => (
                <span key={email} className="inline-flex max-w-full items-center gap-1 rounded-full bg-[rgba(55,53,47,0.08)] py-1 pl-2.5 pr-1 text-[13px] text-[#37352f] animate-fade-in">
                  <span className="truncate">{email}</span>
                  <button type="button" onClick={() => setDraft(recipients.filter(r => r !== email))} aria-label={`Quitar ${email}`} className="rounded-full p-0.5 text-[#787774] hover:bg-[rgba(55,53,47,0.12)] hover:text-[#37352f]">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={input}
                onChange={e => { setInput(e.target.value); setInputError(null) }}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (input.trim()) addRecipient(input) }}
                placeholder={recipients.length === 0 ? 'correo@empresa.com' : 'Agregar otro…'}
                className="min-w-[160px] flex-1 bg-transparent px-1 py-1 text-[#37352f] placeholder:text-[#b4b4b0] focus:outline-none"
                style={{ fontSize: '16px' }}
              />
            </div>
            {inputError ? (
              <div className="mt-1 text-[12px] text-red-600">{inputError}</div>
            ) : (
              recipients.length > 0 && draft !== null && status.configured && (
                <div className="mt-1 text-[11px] text-[#9b9a97]">Se guardarán para los próximos reportes de {company.name}.</div>
              )
            )}
          </div>

          {status.configured ? (
            <label className="mt-3 flex items-center gap-2 text-[13px] text-[#787774] touch-manipulation">
              <input type="checkbox" checked={copyMe} onChange={e => setCopyMe(e.target.checked)} className="h-4 w-4 accent-[#37352f]" />
              Enviarme una copia a {status.senderEmail}
            </label>
          ) : (
            <p className="mt-3 text-[12px] text-[#9b9a97]">
              El envío automático aún no está activado: se abrirá el menú para compartir el PDF por correo.
            </p>
          )}

          {phase.kind === 'error' && (
            <div className="mt-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{phase.text}</div>
          )}

          {/* Acciones */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[8px] bg-[#37352f] px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#2f2d28] disabled:opacity-50 touch-manipulation active:scale-[0.99]"
            >
              {sending && <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />}
              {!sending && (status.configured ? <Send className="h-4 w-4 flex-shrink-0" /> : <Share2 className="h-4 w-4 flex-shrink-0" />)}
              <span className="truncate">{sendLabel}</span>
            </button>
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-[8px] border border-[rgba(55,53,47,0.16)] px-4 py-3 text-[14px] font-semibold text-[#37352f] hover:bg-[rgba(55,53,47,0.06)] transition-colors touch-manipulation"
            >
              <FileText className="h-4 w-4" />
              Ver PDF
            </a>
          </div>
        </>
      )}
    </section>
  )
}
