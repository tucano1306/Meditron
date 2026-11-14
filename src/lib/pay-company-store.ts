// Servidor de las compañías del modo "Por pago": validar sus datos, saber a
// qué compañía va cada trabajo y repartir el pago de las que pagan por día.

import type { PayCompany as PayCompanyRow, Prisma, PrismaClient } from '@prisma/client'
import { prisma } from './prisma'
import { COMPANY_COLORS } from './companies'
import { invalid } from './input'
import { isPaymentMethod } from './payment-jobs'
import { isPayCompanyType, type PayCompany } from './pay-companies'

type Result<T> = { ok: true; value: T } | { ok: false; error: string }
type Db = Prisma.TransactionClient | PrismaClient

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const MAX_RATE = 100_000

export interface CompanyStats {
  pending: number
  pendingCount: number
  jobCount: number
}

export function serializePayCompany(row: PayCompanyRow, stats?: CompanyStats): PayCompany {
  const payType = isPayCompanyType(row.payType) ? row.payType : 'variable'
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    payType,
    rate: payType === 'variable' ? null : row.rate,
    paymentMethod: isPaymentMethod(row.paymentMethod) ? row.paymentMethod : null,
    paysLater: row.paysLater,
    archived: row.archived,
    pending: Math.round((stats?.pending ?? 0) * 100) / 100,
    pendingCount: stats?.pendingCount ?? 0,
    jobCount: stats?.jobCount ?? 0,
  }
}

/** Trabajos y lo que falta por cobrar de cada compañía del usuario */
export async function companyStats(userId: string): Promise<Map<string, CompanyStats>> {
  const [all, pending] = await Promise.all([
    prisma.paymentEntry.groupBy({
      by: ['companyId'],
      where: { userId, completed: true, companyId: { not: null } },
      _count: { _all: true },
    }),
    prisma.paymentEntry.groupBy({
      by: ['companyId'],
      where: { userId, completed: true, companyId: { not: null }, paymentStatus: 'pending' },
      _count: { _all: true },
      _sum: { amount: true, tip: true },
    }),
  ])
  const stats = new Map<string, CompanyStats>()
  for (const group of all) {
    if (group.companyId) stats.set(group.companyId, { pending: 0, pendingCount: 0, jobCount: group._count._all })
  }
  for (const group of pending) {
    const entry = group.companyId ? stats.get(group.companyId) : undefined
    if (!entry) continue
    entry.pending = (group._sum.amount ?? 0) + (group._sum.tip ?? 0)
    entry.pendingCount = group._count._all
  }
  return stats
}

/**
 * Datos de una compañía (crear o editar). Con `partial` solo se validan los
 * campos que vienen; `current` es la compañía antes del cambio.
 */
export function parsePayCompanyInput(
  body: Record<string, unknown>,
  partial: boolean,
  current?: Pick<PayCompanyRow, 'payType' | 'rate'>,
): Result<Prisma.PayCompanyUncheckedUpdateInput> {
  const data: Prisma.PayCompanyUncheckedUpdateInput = {}

  if (body.name !== undefined || !partial) {
    if (typeof body.name !== 'string') return { ok: false, error: 'Escribe el nombre de la compañía' }
    const name = body.name.trim()
    if (!name) return { ok: false, error: 'Escribe el nombre de la compañía' }
    if (name.length > 60) return { ok: false, error: 'El nombre: máximo 60 caracteres' }
    data.name = name
  }
  if (body.color !== undefined) {
    if (typeof body.color !== 'string' || !HEX_COLOR.test(body.color)) return { ok: false, error: 'Color inválido' }
    data.color = body.color
  } else if (!partial) {
    data.color = COMPANY_COLORS[3]
  }

  const payType = body.payType ?? current?.payType ?? (partial ? undefined : 'per_day')
  if (body.payType !== undefined || !partial) {
    if (!isPayCompanyType(payType)) return { ok: false, error: 'Elige cómo te paga la compañía' }
    data.payType = payType
  }
  if (body.rate !== undefined || body.payType !== undefined || !partial) {
    if (payType === 'variable') {
      data.rate = null
    } else {
      const raw = body.rate === undefined ? current?.rate : body.rate
      const rate = typeof raw === 'string' ? Number(raw) : raw
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        return { ok: false, error: payType === 'per_day' ? 'Escribe cuánto te paga por día' : 'Escribe cuánto te paga por trabajo' }
      }
      if (rate > MAX_RATE) return { ok: false, error: invalid('El monto') }
      data.rate = Math.round(rate * 100) / 100
    }
  }

  if (body.paymentMethod !== undefined) {
    if (body.paymentMethod !== null && body.paymentMethod !== '' && !isPaymentMethod(body.paymentMethod)) {
      return { ok: false, error: 'Método de pago inválido' }
    }
    data.paymentMethod = body.paymentMethod || null
  }
  for (const key of ['paysLater', 'archived'] as const) {
    if (body[key] === undefined) continue
    if (typeof body[key] !== 'boolean') return { ok: false, error: 'Datos inválidos' }
    data[key] = body[key]
  }
  return { ok: true, value: data }
}

// ── Compañía de cada trabajo ──────────────────────────────────────────────────

export interface JobCompanyChoice {
  companyId: string | null
  /** El pago lo pone la compañía (solo las que pagan por día) */
  amountAuto: boolean
  company: PayCompanyRow | null
}

/**
 * A qué compañía va un trabajo y si su pago es automático. Solo se aceptan
 * compañías del mismo usuario. `current` es el trabajo antes del cambio.
 */
export async function resolveJobCompany(
  userId: string,
  body: Record<string, unknown>,
  current: { companyId: string | null; amountAuto: boolean } | null,
): Promise<Result<JobCompanyChoice>> {
  let companyId = current?.companyId ?? null
  if (body.companyId !== undefined) {
    if (body.companyId === null || body.companyId === '') companyId = null
    else if (typeof body.companyId !== 'string' || body.companyId.length > 40) return { ok: false, error: 'Compañía inválida' }
    else companyId = body.companyId
  }
  const company = companyId ? await prisma.payCompany.findFirst({ where: { id: companyId, userId } }) : null
  if (companyId && !company) return { ok: false, error: 'Esa compañía ya no existe' }

  const perDay = company?.payType === 'per_day' && Boolean(company.rate)
  let amountAuto = current?.amountAuto ?? false
  if (body.autoPay !== undefined) amountAuto = body.autoPay === true
  if (body.autoPay === true && !perDay) return { ok: false, error: 'Escribe cuánto te pagaron' }
  if (!perDay) amountAuto = false
  return { ok: true, value: { companyId, amountAuto, company } }
}

function hourlyRateOf(amount: number, seconds: number | null): number {
  return seconds && seconds > 0 ? amount / (seconds / 3600) : 0
}

/**
 * Compañías que pagan por día: el pago va una sola vez por día, en el primer
 * registro automático de ese día. Si el usuario escribió a mano el pago de
 * algún registro, ese manda y los automáticos quedan en $0. Se llama después
 * de crear, editar, mover o borrar un trabajo de esa compañía.
 *
 * El día conserva el monto que ya tenía (un cambio de tarifa no altera días
 * anteriores) salvo que se pida `forceRate`.
 */
export async function rebalanceDayPay(db: Db, userId: string, companyId: string | null | undefined, date: Date, forceRate?: number): Promise<boolean> {
  if (!companyId) return false
  const company = await db.payCompany.findFirst({ where: { id: companyId, userId }, select: { payType: true, rate: true } })
  if (company?.payType !== 'per_day') return false

  const entries = await db.paymentEntry.findMany({
    where: { userId, companyId, date, completed: true },
    orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    select: { id: true, amount: true, amountAuto: true, duration: true },
  })
  const auto = entries.filter(e => e.amountAuto)
  if (auto.length === 0) return false
  const paidByHand = entries.some(e => !e.amountAuto && (e.amount ?? 0) > 0)
  const kept = Math.max(0, ...auto.map(e => e.amount ?? 0))
  const dayPay = forceRate ?? (kept > 0 ? kept : company.rate ?? 0)

  let changed = false
  for (const [i, entry] of auto.entries()) {
    const amount = !paidByHand && i === 0 ? dayPay : 0
    if (amount === (entry.amount ?? 0)) continue
    await db.paymentEntry.update({ where: { id: entry.id }, data: { amount, hourlyRate: hourlyRateOf(amount, entry.duration) } })
    changed = true
  }
  return changed
}

/** Reparte el pago de los días tocados (sin repetir el mismo día) */
export async function rebalanceDays(db: Db, userId: string, days: { companyId: string | null | undefined; date: Date | null | undefined }[]) {
  const seen = new Set<string>()
  for (const { companyId, date } of days) {
    if (!companyId || !date) continue
    const key = `${companyId}|${date.toISOString()}`
    if (seen.has(key)) continue
    seen.add(key)
    await rebalanceDayPay(db, userId, companyId, date)
  }
}
