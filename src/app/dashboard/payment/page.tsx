'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BarChart3, Briefcase, Check, Hourglass, Plus, Search, Undo2 } from 'lucide-react'
import { PaymentTimer } from '@/components/PaymentTimer'
import { AppTopBar } from '@/components/AppTopBar'
import { InstallPWA } from '@/components/InstallPWA'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaymentSummaryCards } from '@/components/payment/PaymentSummaryCards'
import { PaymentJobsPanel } from '@/components/payment/PaymentJobsPanel'
import { PaymentCollectPanel, type CollectFocus } from '@/components/payment/PaymentCollectPanel'
import { PayCompanyOwed } from '@/components/payment/PayCompanyOwed'
import { PaymentInsightsPanel } from '@/components/payment/PaymentInsightsPanel'
import { PaymentSearchPanel } from '@/components/payment/PaymentSearchPanel'
import { PaymentJobSheet, type SheetMode } from '@/components/payment/PaymentJobSheet'
import { PayCompanyManager } from '@/components/payment/PayCompanyManager'
import { useFetchData, type PaymentSummary } from '@/components/payment/data'
import { PAY_ACCENT } from '@/components/payment/shared'
import { isCoveredByDayPay, jobEarned, ratePerHour, type PaymentJob } from '@/lib/payment-jobs'
import type { PayCompany } from '@/lib/pay-companies'
import { formatCurrency } from '@/lib/utils'

type Tab = 'jobs' | 'collect' | 'insights' | 'search'

/** Compañía elegida la última vez (se propone al iniciar el siguiente trabajo) */
const COMPANY_KEY = 'meditron_pay_company'

function savedCompanyId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(COMPANY_KEY)
  } catch {
    return null
  }
}

function pickCompanyId(companies: PayCompany[] | null, selected: string | null): string | null {
  if (selected === '') return null
  if (!companies) return selected
  if (selected && companies.some(c => c.id === selected)) return selected
  return companies.find(c => !c.archived)?.id ?? null
}

/** La hoja se vuelve a montar al cambiar de trabajo */
function sheetKey(sheet: SheetMode): string {
  if (sheet.kind === 'create') return 'create'
  if (sheet.kind === 'move') return `move:${sheet.jobs.map(j => j.id).join(',')}`
  return sheet.job.id
}

interface Toast {
  text: string
  undo?: () => Promise<void>
  job?: PaymentJob
}

const tabTriggerClass = 'relative flex-1 flex flex-col items-center gap-1 py-3 px-1 text-[11px] font-medium text-[#787774] rounded-lg border-0 data-[state=active]:bg-[#37352f] data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-[rgba(55,53,47,0.06)] transition-all touch-manipulation min-h-[52px]'

export default function PaymentDashboardPage() {
  const router = useRouter()
  const { status } = useSession()
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState<Tab>('jobs')
  const [sheet, setSheet] = useState<SheetMode | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  // Compañías: la elegida para el próximo trabajo y la hoja para configurarlas
  const [companiesKey, setCompaniesKey] = useState(0)
  const [selectedCompany, setSelectedCompany] = useState<string | null>(savedCompanyId)
  const [manager, setManager] = useState<{ create: boolean; editId?: string } | null>(null)
  // Compañía cuyo aviso "te debe" se tocó: Cobros baja hasta ella
  const [collectFocus, setCollectFocus] = useState<CollectFocus | null>(null)
  // Texto con el que se abre Buscar desde la búsqueda rápida de Trabajos
  const [searchSeed, setSearchSeed] = useState<{ q: string; nonce: number } | null>(null)

  const { data: summary } = useFetchData<PaymentSummary>(status === 'authenticated' ? `/api/payment/summary?r=${refreshKey}` : null)
  const { data: companies } = useFetchData<PayCompany[]>(status === 'authenticated' ? `/api/payment/companies?r=${companiesKey}-${refreshKey}` : null)
  // Siempre hay una compañía elegida: la guardada o, si no hay o ya no existe,
  // la primera activa. '' = un trabajo en curso que se empezó sin compañía.
  const companyId = pickCompanyId(companies, selectedCompany)

  const changeCompany = useCallback((id: string | null) => {
    setSelectedCompany(id)
    try {
      if (id) localStorage.setItem(COMPANY_KEY, id)
      else localStorage.removeItem(COMPANY_KEY)
    } catch { /* sin almacenamiento */ }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // Los avisos se van solos
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(id)
  }, [toast])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  const handleChanged = useCallback((text: string, undo?: () => Promise<void>) => {
    refresh()
    setToast({ text, undo })
  }, [refresh])

  const handleTimerComplete = useCallback((job: PaymentJob | null) => {
    refresh()
    // Terminó un trabajo empezado sin compañía: el próximo vuelve a tener una
    setSelectedCompany(prev => (prev === '' ? savedCompanyId() : prev))
    if (!job) {
      setToast({ text: 'Trabajo guardado' })
      return
    }
    const earned = jobEarned(job)
    if (isCoveredByDayPay(job) && earned === 0) {
      setToast({ text: `Guardado · el pago de hoy con ${job.company?.name ?? 'la compañía'} ya estaba anotado`, job })
      return
    }
    setToast({ text: `Trabajo guardado · ${formatCurrency(earned)} · ${formatCurrency(ratePerHour(earned, job.duration))}/h`, job })
  }, [refresh])

  const goToCollect = () => {
    setTab('collect')
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openSearch = (q: string) => {
    setSearchSeed(prev => ({ q, nonce: (prev?.nonce ?? 0) + 1 }))
    setTab('search')
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const reviewCompany = (id: string) => {
    setCollectFocus(prev => ({ companyId: id, nonce: (prev?.nonce ?? 0) + 1 }))
    goToCollect()
  }

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfbfa]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#37352f] border-t-transparent" />
      </div>
    )
  }

  const pendingCount = summary?.pending.count ?? 0

  return (
    <div className="min-h-[100dvh] bg-[#fbfbfa] font-notion">
      {/* Barra superior: el logo y el título llevan al inicio */}
      <AppTopBar mode="payment" />

      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-6">
        <PaymentTimer
          onComplete={handleTimerComplete}
          companies={companies}
          companyId={companyId}
          onCompanyChange={changeCompany}
          onManageCompanies={create => setManager({ create: Boolean(create) })}
          onEditCompany={id => setManager({ create: false, editId: id })}
        />

        {/* Un trabajo hecho sin cronómetro */}
        <button
          type="button"
          onClick={() => setSheet({ kind: 'create' })}
          className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-[rgba(55,53,47,0.25)] bg-white px-4 py-3.5 text-left transition-colors hover:border-[rgba(55,53,47,0.45)] touch-manipulation"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white transition-transform duration-200 group-hover:scale-105" style={{ backgroundColor: PAY_ACCENT }}>
            <Plus className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-[#37352f]">Agregar trabajo</span>
            <span className="block text-[12px] text-[#787774]">¿Lo hiciste sin el cronómetro? Anótalo con su hora y su pago</span>
          </span>
        </button>

        {summary ? (
          <PaymentSummaryCards summary={summary} onPendingClick={goToCollect} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-[120px] animate-pulse rounded-xl border border-[rgba(55,53,47,0.09)] bg-white" />)}
          </div>
        )}

        {/* Lo que te debe cada compañía, como en Por Hora */}
        <PayCompanyOwed companies={companies} onReview={reviewCompany} />

        <div ref={tabsRef} className="scroll-mt-20">
          <Tabs value={tab} onValueChange={value => setTab(value as Tab)} className="w-full">
            <TabsList className="mb-5 flex h-auto w-full gap-0.5 rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-1 shadow-sm">
              <TabsTrigger value="jobs" className={tabTriggerClass}>
                <Briefcase className="h-4 w-4" />
                <span>Trabajos</span>
              </TabsTrigger>
              <TabsTrigger value="collect" className={tabTriggerClass}>
                <Hourglass className="h-4 w-4" />
                <span>Cobros</span>
                {pendingCount > 0 && (
                  <span className="absolute right-2 top-1.5 min-w-[18px] rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-[18px] text-white">{pendingCount}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="insights" className={tabTriggerClass}>
                <BarChart3 className="h-4 w-4" />
                <span>Resumen</span>
              </TabsTrigger>
              <TabsTrigger value="search" className={tabTriggerClass}>
                <Search className="h-4 w-4" />
                <span>Buscar</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="jobs">
              <PaymentJobsPanel
                refreshKey={refreshKey}
                averageRate={summary?.month.rate}
                onOpen={job => setSheet({ kind: 'view', job })}
                onAdd={() => setSheet({ kind: 'create' })}
                onAdvancedSearch={openSearch}
              />
            </TabsContent>
            <TabsContent value="collect">
              <PaymentCollectPanel refreshKey={refreshKey} focus={collectFocus} onOpen={job => setSheet({ kind: 'view', job })} onChanged={handleChanged} />
            </TabsContent>
            <TabsContent value="insights">
              {summary && <PaymentInsightsPanel summary={summary} refreshKey={refreshKey} onOpen={job => setSheet({ kind: 'view', job })} />}
            </TabsContent>
            <TabsContent value="search">
              <PaymentSearchPanel
                key={searchSeed?.nonce ?? 0}
                refreshKey={refreshKey}
                companies={companies}
                averageRate={summary?.month.rate}
                initialQuery={searchSeed?.q}
                onOpen={job => setSheet({ kind: 'view', job })}
                onMove={jobs => setSheet({ kind: 'move', jobs })}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {sheet && (
        <PaymentJobSheet
          key={sheetKey(sheet)}
          mode={sheet}
          companies={companies}
          defaultCompanyId={companyId}
          onClose={() => setSheet(null)}
          onChanged={text => handleChanged(text)}
        />
      )}

      {manager && companies && (
        <PayCompanyManager
          companies={companies}
          startCreating={manager.create}
          editId={manager.editId}
          onClose={() => setManager(null)}
          onChanged={(text, created) => {
            setCompaniesKey(k => k + 1)
            if (created) changeCompany(created.id)
            handleChanged(text)
          }}
        />
      )}

      {/* Aviso de la última acción */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6">
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-[#37352f] px-4 py-3 text-[13px] text-white shadow-xl animate-slide-up">
            <Check className="h-4 w-4 flex-shrink-0 text-emerald-300" />
            <span className="min-w-0 flex-1">{toast.text}</span>
            {toast.job && (
              <button type="button" onClick={() => { setSheet({ kind: 'view', job: toast.job as PaymentJob }); setToast(null) }} className="flex-shrink-0 rounded-md px-2 py-1 font-semibold text-emerald-300 hover:bg-white/10">
                Ver
              </button>
            )}
            {toast.undo && (
              <button
                type="button"
                onClick={async () => { const undo = toast.undo; setToast(null); await undo?.(); refresh() }}
                className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 font-semibold text-emerald-300 hover:bg-white/10"
              >
                <Undo2 className="h-3.5 w-3.5" /> Deshacer
              </button>
            )}
          </div>
        </div>
      )}

      <InstallPWA />
    </div>
  )
}
