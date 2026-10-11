'use client'

import { useEffect, useState } from 'react'
import type { JobTotals, PaymentJob } from '@/lib/payment-jobs'

// Datos del modo "Por pago" que piden los paneles.

export interface GroupTotals {
  key: string
  earned: number
  count: number
  seconds: number
  rate: number
}

export interface PaymentSummary {
  today: JobTotals & { date: string }
  week: JobTotals & { start: string; end: string }
  month: JobTotals & { start: string }
  pending: JobTotals & { oldestDate: string | null }
  weekDays: { date: string; earned: number; tips: number; seconds: number; count: number }[]
  weeks: (JobTotals & { start: string; end: string })[]
  topClients: GroupTotals[]
  byMethod: GroupTotals[]
  bestJob: PaymentJob | null
}

export interface JobsResult {
  jobs: PaymentJob[]
  totals: JobTotals
  truncated: boolean
}

/** Pide `url` cada vez que cambia; mientras carga conserva el resultado anterior */
export function useFetchData<T>(url: string | null): { data: T | null; loading: boolean; error: boolean } {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: boolean }>({ url: null, data: null, error: false })

  useEffect(() => {
    if (!url) return
    let cancelled = false
    fetch(url)
      .then(res => res.json())
      .then(json => {
        if (!cancelled) setState({ url, data: json.success ? json.data : null, error: !json.success })
      })
      .catch(() => {
        if (!cancelled) setState(prev => ({ url, data: prev.data, error: true }))
      })
    return () => { cancelled = true }
  }, [url])

  return { data: state.data, loading: state.url !== url, error: state.error }
}

/** "YYYY-MM-DD" del día en Florida de un instante */
export function floridaDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso))
}
