'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { BarChart3, Briefcase, Check, DollarSign, Hourglass, LogOut, Plus, Undo2 } from 'lucide-react'
import { PaymentTimer } from '@/components/PaymentTimer'
import { InstallPWA } from '@/components/InstallPWA'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaymentSummaryCards } from '@/components/payment/PaymentSummaryCards'
import { PaymentJobsPanel } from '@/components/payment/PaymentJobsPanel'
import { PaymentCollectPanel } from '@/components/payment/PaymentCollectPanel'
import { PaymentInsightsPanel } from '@/components/payment/PaymentInsightsPanel'
import { PaymentJobSheet, type SheetMode } from '@/components/payment/PaymentJobSheet'
import { useFetchData, type PaymentSummary } from '@/components/payment/data'
import { PAY_ACCENT } from '@/components/payment/shared'
import { jobEarned, ratePerHour, type PaymentJob } from '@/lib/payment-jobs'
import { formatCurrency } from '@/lib/utils'

type Tab = 'jobs' | 'collect' | 'insights'

interface Toast {
  text: string
  undo?: () => Promise<void>
  job?: PaymentJob
}

const tabTriggerClass = 'relative flex-1 flex flex-col items-center gap-1 py-3 px-1 text-[11px] font-medium text-[#787774] rounded-lg border-0 data-[state=active]:bg-[#37352f] data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-[rgba(55,53,47,0.06)] transition-all touch-manipulation min-h-[52px]'

export default function PaymentDashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState<Tab>('jobs')
  const [sheet, setSheet] = useState<SheetMode | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)

  const { data: summary } = useFetchData<PaymentSummary>(status === 'authenticated' ? `/api/payment/summary?r=${refreshKey}` : null)

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
    if (!job) {
      setToast({ text: 'Trabajo guardado' })
      return
    }
    const earned = jobEarned(job)
    setToast({ text: `Trabajo guardado · ${formatCurrency(earned)} · ${formatCurrency(ratePerHour(earned, job.duration))}/h`, job })
  }, [refresh])

  const goToCollect = () => {
    setTab('collect')
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
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
      <header className="sticky top-0 z-20 border-b border-[rgba(55,53,47,0.07)] bg-[#fbfbfa]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => router.push('/mode-select')}
            className="-ml-1.5 flex items-center gap-2 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-[rgba(55,53,47,0.08)] touch-manipulation"
            aria-label="Volver al inicio"
            title="Volver al inicio"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded" style={{ backgroundColor: PAY_ACCENT }}>
              <DollarSign className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="text-[14px] font-semibold text-[#37352f]">Por Pago</span>
          </button>
          <div className="flex items-center gap-2">
            {session?.user?.name && <span className="hidden text-[13px] text-[#787774] sm:inline">{session.user.name}</span>}
            <button type="button" onClick={handleLogout} aria-label="Cerrar sesión" className="rounded-[4px] p-1.5 text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.08)] hover:text-[#37352f]">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-6">
        <PaymentTimer onComplete={handleTimerComplete} />

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
            </TabsList>

            <TabsContent value="jobs">
              <PaymentJobsPanel
                refreshKey={refreshKey}
                averageRate={summary?.month.rate}
                onOpen={job => setSheet({ kind: 'view', job })}
                onAdd={() => setSheet({ kind: 'create' })}
              />
            </TabsContent>
            <TabsContent value="collect">
              <PaymentCollectPanel refreshKey={refreshKey} onOpen={job => setSheet({ kind: 'view', job })} onChanged={handleChanged} />
            </TabsContent>
            <TabsContent value="insights">
              {summary && <PaymentInsightsPanel summary={summary} refreshKey={refreshKey} onOpen={job => setSheet({ kind: 'view', job })} />}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {sheet && (
        <PaymentJobSheet
          key={sheet.kind === 'create' ? 'create' : sheet.job.id}
          mode={sheet}
          onClose={() => setSheet(null)}
          onChanged={text => handleChanged(text)}
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
