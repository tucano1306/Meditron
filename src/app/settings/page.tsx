'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { ArrowLeft, Building2, Check, ChevronRight, Clock, DollarSign, Loader2, LogOut } from 'lucide-react'
import { CompanyManager } from '@/components/CompanyManager'
import { PayCompanyManager } from '@/components/payment/PayCompanyManager'
import { PAY_ACCENT } from '@/components/payment/shared'
import { useFetchData } from '@/components/payment/data'
import { resetCompanies, useCompanies } from '@/hooks/useCompanies'
import type { OrgMembership } from '@/lib/org-shared'
import type { PayCompany } from '@/lib/pay-companies'

// Configuración: lo que no es del día a día (la empresa, las compañías y la
// cuenta). Aquí van los ajustes nuevos que se agreguen a la app.

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Qué es el usuario en el modo Empresa */
function orgStatus(memberships: OrgMembership[] | null): string {
  if (!memberships) return 'Cargando…'
  if (memberships.length === 0) return 'Únete con un código o crea la de tu negocio'
  if (memberships.length > 1) return `${plural(memberships.length, 'empresa', 'empresas')}: ${memberships.map(m => m.org.name).join(', ')}`
  const [m] = memberships
  if (m.status === 'pending') return `${m.org.name} · esperando aprobación`
  if (m.status === 'inactive') return `${m.org.name} · inactivo`
  return m.role === 'admin' ? `Administras ${m.org.name}` : `Empleado en ${m.org.name}`
}

function Section({ title, children, delay }: { readonly title: string; readonly children: ReactNode; readonly delay: number }) {
  return (
    <section className="animate-card-in" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-[#787774]">{title}</h2>
      <div className="divide-y divide-[rgba(55,53,47,0.07)] overflow-hidden rounded-2xl border border-[rgba(55,53,47,0.09)] bg-white shadow-[0_1px_2px_rgba(15,15,15,0.04)]">
        {children}
      </div>
    </section>
  )
}

interface RowProps {
  readonly icon: ReactNode
  /** Color del ícono */
  readonly tint: string
  readonly title: string
  readonly description: string
  readonly busy?: boolean
  readonly danger?: boolean
  readonly onClick: () => void
}

function Row({ icon, tint, title, description, busy = false, danger = false, onClick }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-[rgba(55,53,47,0.03)] disabled:opacity-70 touch-manipulation"
    >
      <span
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: `${tint}1a`, color: tint }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold ${danger ? 'text-[#e03e3e]' : 'text-[#37352f]'}`}>{title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-[#787774]">{description}</span>
      </span>
      {busy
        ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-[#787774]" />
        : !danger && <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#9b9a97] transition-transform duration-200 group-hover:translate-x-0.5" />}
    </button>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const authed = status === 'authenticated'
  const companies = useCompanies()
  const [payKey, setPayKey] = useState(0)
  const { data: payCompanies } = useFetchData<PayCompany[]>(authed ? `/api/payment/companies?r=${payKey}` : null)
  const { data: memberships } = useFetchData<OrgMembership[]>(authed ? '/api/org' : null)
  const [manager, setManager] = useState<'hourly' | 'payment' | null>(null)
  const [busy, setBusy] = useState<'team' | 'logout' | null>(null)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(id)
  }, [toast])

  const goBack = () => {
    // Vuelve a donde estaba (Por Hora o Por Pago); si entró directo, al inicio
    if (window.history.length > 1) router.back()
    else router.push('/mode-select')
  }

  const logout = async () => {
    setBusy('logout')
    await signOut({ redirect: false })
    // Que la siguiente cuenta en este teléfono no vea las compañías de esta
    resetCompanies()
    router.push('/login')
  }

  const notify = (text: string) => setToast({ text, id: Date.now() })
  const name = session?.user?.name || session?.user?.email?.split('@')[0] || ''
  const email = session?.user?.email ?? ''
  const hourly = companies?.filter(c => !c.archived) ?? null
  const paying = payCompanies?.filter(c => !c.archived) ?? null

  return (
    <div className="min-h-[100dvh] bg-[#fbfbfa] font-notion">
      <header className="sticky top-0 z-20 border-b border-[rgba(55,53,47,0.07)] bg-[#fbfbfa]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
          <button
            type="button"
            onClick={goBack}
            aria-label="Volver"
            className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-[#37352f] transition-colors hover:bg-[rgba(55,53,47,0.08)] touch-manipulation"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <span className="text-[15px] font-semibold tracking-tight text-[#37352f]">Configuración</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-7 px-4 pb-16 pt-6">
        {/* Cuenta */}
        <div className="flex items-center gap-3.5 px-1 animate-card-in">
          {authed ? (
            <>
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#37352f] text-[15px] font-bold text-white">
                {initialsOf(name)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[18px] font-bold text-[#37352f]">{name}</div>
                {email && <div className="truncate text-[13px] text-[#787774]">{email}</div>}
              </div>
            </>
          ) : (
            <>
              <span className="h-12 w-12 flex-shrink-0 animate-pulse rounded-full bg-[rgba(55,53,47,0.08)]" />
              <div className="space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-[rgba(55,53,47,0.08)]" />
                <div className="h-3 w-48 animate-pulse rounded bg-[rgba(55,53,47,0.06)]" />
              </div>
            </>
          )}
        </div>

        <Section title="Trabajo" delay={60}>
          <Row
            icon={<Building2 className="h-5 w-5" />}
            tint="#2e75cc"
            title="Empresa"
            description={orgStatus(memberships)}
            busy={busy === 'team'}
            onClick={() => { setBusy('team'); router.push('/team') }}
          />
          <Row
            icon={<Clock className="h-5 w-5" />}
            tint="#37352f"
            title="Compañías por hora"
            description={hourly ? `${plural(hourly.length, 'compañía', 'compañías')} · tarifa, overtime y semana de pago` : 'Cargando…'}
            onClick={() => { if (companies) setManager('hourly') }}
          />
          <Row
            icon={<DollarSign className="h-5 w-5" />}
            tint={PAY_ACCENT}
            title="Compañías de Por Pago"
            description={paying ? (paying.length > 0 ? `${plural(paying.length, 'compañía', 'compañías')} · por día, por trabajo o variable` : 'Ninguna todavía · por día, por trabajo o variable') : 'Cargando…'}
            onClick={() => { if (payCompanies) setManager('payment') }}
          />
        </Section>

        <Section title="Cuenta" delay={120}>
          <Row
            icon={<LogOut className="h-5 w-5" />}
            tint="#e03e3e"
            title="Cerrar sesión"
            description={email ? `Salir de ${email}` : 'Salir de esta cuenta en este teléfono'}
            busy={busy === 'logout'}
            danger
            onClick={logout}
          />
        </Section>
      </main>

      {manager === 'hourly' && companies && (
        <CompanyManager
          companies={companies}
          onClose={() => setManager(null)}
          // La hoja ya refresca la lista y muestra sus propios avisos
          onChanged={() => {}}
        />
      )}
      {manager === 'payment' && payCompanies && (
        <PayCompanyManager
          companies={payCompanies}
          onClose={() => setManager(null)}
          onChanged={text => { setPayKey(k => k + 1); notify(text) }}
        />
      )}

      {toast && (
        <div key={toast.id} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6">
          <div className="flex max-w-md items-center gap-3 rounded-xl bg-[#37352f] px-4 py-3 text-[13px] text-white shadow-xl animate-slide-up">
            <Check className="h-4 w-4 flex-shrink-0 text-emerald-300" />
            <span>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  )
}
