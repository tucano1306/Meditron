// Búsqueda de trabajos del modo "Por pago": los filtros viajan en la URL
// (?q, ?from, ?to, ?status, ?companyId, ?method, ?vehicle, ?tip, ?min, ?max,
// ?sort). Lo comparten la API de trabajos, la exportación a CSV y la pestaña
// Buscar, así lo que se ve y lo que se exporta es siempre lo mismo.

import type { Prisma } from '@prisma/client'
import { isDateKey } from './input'
import { isPaymentMethod, jobEarned, ratePerHour, type PaymentJob, type PaymentMethod } from './payment-jobs'

export type JobSort = 'recent' | 'oldest' | 'amount' | 'rate' | 'duration'

export const JOB_SORTS: { value: JobSort; label: string }[] = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'amount', label: 'Mayor pago' },
  { value: 'rate', label: 'Mejor $/hora' },
  { value: 'duration', label: 'Más largos' },
]

/** Compañía "ninguna": trabajos sin compañía */
export const NO_COMPANY = 'none'

export interface JobSearch {
  q: string
  /** YYYY-MM-DD; vacío = sin límite */
  from: string
  to: string
  status: 'all' | 'paid' | 'pending'
  /** Ids de compañía; NO_COMPANY = sin compañía. Vacío = todas */
  companyIds: string[]
  methods: PaymentMethod[]
  vehicles: string[]
  /** Solo los que tienen propina */
  withTip: boolean
  /** Total (pago + propina) mínimo y máximo */
  min: number | null
  max: number | null
  sort: JobSort
}

export const EMPTY_SEARCH: JobSearch = {
  q: '', from: '', to: '', status: 'all', companyIds: [], methods: [], vehicles: [],
  withTip: false, min: null, max: null, sort: 'recent',
}

const MAX_LIST = 20

function list(value: string | null, max = MAX_LIST): string[] {
  if (!value) return []
  return [...new Set(value.split(',').map(v => v.trim()).filter(Boolean))].slice(0, max).map(v => v.slice(0, 40))
}

function money(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? n : null
}

/** Filtros desde la URL (lo inválido se ignora) */
export function parseJobSearch(params: URLSearchParams): JobSearch {
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const status = params.get('status')
  const sort = params.get('sort')
  return {
    q: (params.get('q') ?? '').trim().slice(0, 80),
    // Solo fechas que existen (2026-13-01 no)
    from: isDateKey(from) ? from : '',
    to: isDateKey(to) ? to : '',
    status: status === 'paid' || status === 'pending' ? status : 'all',
    companyIds: list(params.get('companyId')),
    methods: list(params.get('method')).filter(isPaymentMethod),
    vehicles: list(params.get('vehicle')),
    withTip: params.get('tip') === '1',
    min: money(params.get('min')),
    max: money(params.get('max')),
    sort: JOB_SORTS.some(s => s.value === sort) ? (sort as JobSort) : 'recent',
  }
}

/** Filtros a la URL (solo los que no están vacíos) */
export function jobSearchParams(search: JobSearch): URLSearchParams {
  const params = new URLSearchParams()
  if (search.q.trim()) params.set('q', search.q.trim())
  if (search.from) params.set('from', search.from)
  if (search.to) params.set('to', search.to)
  if (search.status !== 'all') params.set('status', search.status)
  if (search.companyIds.length > 0) params.set('companyId', search.companyIds.join(','))
  if (search.methods.length > 0) params.set('method', search.methods.join(','))
  if (search.vehicles.length > 0) params.set('vehicle', search.vehicles.join(','))
  if (search.withTip) params.set('tip', '1')
  if (search.min !== null) params.set('min', String(search.min))
  if (search.max !== null) params.set('max', String(search.max))
  if (search.sort !== 'recent') params.set('sort', search.sort)
  return params
}

/** Cuántos filtros (además del texto, las fechas y el orden) están puestos */
export function activeFilterCount(search: JobSearch): number {
  return [
    search.status !== 'all',
    search.companyIds.length > 0,
    search.methods.length > 0,
    search.vehicles.length > 0,
    search.withTip,
    search.min !== null || search.max !== null,
  ].filter(Boolean).length
}

/** Condiciones de la base de datos (el monto total y el $/h se filtran después) */
export function jobSearchWhere(userId: string, search: JobSearch): Prisma.PaymentEntryWhereInput {
  const and: Prisma.PaymentEntryWhereInput[] = []
  if (search.from || search.to) {
    and.push({
      date: {
        ...(search.from ? { gte: new Date(`${search.from}T00:00:00Z`) } : {}),
        ...(search.to ? { lte: new Date(`${search.to}T00:00:00Z`) } : {}),
      },
    })
  }
  if (search.status !== 'all') and.push({ paymentStatus: search.status })
  if (search.companyIds.length > 0) {
    const ids = search.companyIds.filter(id => id !== NO_COMPANY)
    const or: Prisma.PaymentEntryWhereInput[] = []
    if (ids.length > 0) or.push({ companyId: { in: ids } })
    if (search.companyIds.includes(NO_COMPANY)) or.push({ companyId: null })
    and.push({ OR: or })
  }
  if (search.methods.length > 0) and.push({ paymentMethod: { in: search.methods } })
  if (search.vehicles.length > 0) and.push({ vehicle: { in: search.vehicles } })
  if (search.withTip) and.push({ tip: { gt: 0 } })
  if (search.q) {
    // "#123" busca el número de trabajo 123
    const text = search.q.replace(/^#/, '')
    and.push({
      OR: [
        { client: { contains: text, mode: 'insensitive' } },
        { jobNumber: { contains: text, mode: 'insensitive' } },
        { vehicle: { contains: text, mode: 'insensitive' } },
        { notes: { contains: text, mode: 'insensitive' } },
        { company: { name: { contains: text, mode: 'insensitive' } } },
      ],
    })
  }
  return { userId, completed: true, AND: and }
}

/** Orden en la base de datos (el de $/h se hace después) */
export function jobSearchOrder(search: JobSearch): Prisma.PaymentEntryOrderByWithRelationInput[] {
  switch (search.sort) {
    case 'oldest': return [{ startTime: 'asc' }]
    case 'duration': return [{ duration: 'desc' }, { startTime: 'desc' }]
    default: return [{ startTime: 'desc' }]
  }
}

/** Filtro por monto total y orden final de los trabajos ya traídos */
export function refineJobs(jobs: PaymentJob[], search: JobSearch): PaymentJob[] {
  const filtered = jobs.filter(job => {
    const earned = jobEarned(job)
    if (search.min !== null && earned < search.min) return false
    if (search.max !== null && earned > search.max) return false
    return true
  })
  if (search.sort === 'amount') {
    return filtered.sort((a, b) => jobEarned(b) - jobEarned(a) || b.startTime.localeCompare(a.startTime))
  }
  if (search.sort === 'rate') {
    const rate = (job: PaymentJob) => ratePerHour(jobEarned(job), job.duration)
    return filtered.sort((a, b) => rate(b) - rate(a) || b.startTime.localeCompare(a.startTime))
  }
  return filtered
}
