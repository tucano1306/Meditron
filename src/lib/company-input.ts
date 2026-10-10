// Validación de los datos de compañías y reglas de pago que llegan a la API.

import { COMPANY_COLORS, isPayType, type PayRule } from './companies'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const HEX_COLOR = /^#[0-9a-f]{6}$/i

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

function num(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

export function parseRuleInput(body: Record<string, unknown>, effectiveFrom: string): Result<Omit<PayRule, 'id'>> {
  if (!DATE_KEY.test(effectiveFrom)) return { ok: false, error: 'Fecha de inicio inválida' }
  if (!isPayType(body.payType)) return { ok: false, error: 'Tipo de pago inválido' }
  const hourlyRate = num(body.hourlyRate)
  if (hourlyRate === null || hourlyRate <= 0 || hourlyRate > 10000) {
    return { ok: false, error: 'La tarifa por hora debe ser mayor que 0' }
  }
  if (body.payType === 'hourly') {
    return { ok: true, value: { effectiveFrom, payType: 'hourly', hourlyRate, overtimeAfterHours: null, overtimeMultiplier: null } }
  }
  const overtimeAfterHours = num(body.overtimeAfterHours)
  const maxHours = body.payType === 'daily_overtime' ? 24 : 168
  if (overtimeAfterHours === null || overtimeAfterHours <= 0 || overtimeAfterHours > maxHours) {
    return { ok: false, error: `Las horas antes del overtime deben estar entre 0 y ${maxHours}` }
  }
  const overtimeMultiplier = num(body.overtimeMultiplier)
  if (overtimeMultiplier === null || overtimeMultiplier < 1 || overtimeMultiplier > 5) {
    return { ok: false, error: 'El multiplicador del overtime debe estar entre 1 y 5' }
  }
  return { ok: true, value: { effectiveFrom, payType: body.payType, hourlyRate, overtimeAfterHours, overtimeMultiplier } }
}

export interface CompanyFields {
  name?: string
  color?: string
  weekStartsOn?: number
  trackJobNumber?: boolean
  trackVehicle?: boolean
  trackServiceType?: boolean
  trackCompanyPaid?: boolean
  archived?: boolean
  sortOrder?: number
}

const FLAG_FIELDS = ['trackJobNumber', 'trackVehicle', 'trackServiceType', 'trackCompanyPaid', 'archived'] as const

/** Campos editables de una compañía; con `partial` solo valida los que vienen. */
export function parseCompanyInput(body: Record<string, unknown>, partial: boolean): Result<CompanyFields> {
  const value: CompanyFields = {}
  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 60) return { ok: false, error: 'El nombre es obligatorio (máx. 60 caracteres)' }
    value.name = name
  }
  if (body.color !== undefined) {
    if (typeof body.color !== 'string' || !HEX_COLOR.test(body.color)) return { ok: false, error: 'Color inválido' }
    value.color = body.color
  } else if (!partial) {
    value.color = COMPANY_COLORS[0]
  }
  if (body.weekStartsOn !== undefined) {
    const day = num(body.weekStartsOn)
    if (day === null || !Number.isInteger(day) || day < 0 || day > 6) return { ok: false, error: 'Día de inicio de semana inválido' }
    value.weekStartsOn = day
  }
  for (const key of FLAG_FIELDS) {
    const flag = body[key]
    if (flag !== undefined) {
      if (typeof flag !== 'boolean') return { ok: false, error: `Valor inválido para ${key}` }
      value[key] = flag
    }
  }
  if (body.sortOrder !== undefined) {
    const order = num(body.sortOrder)
    if (order === null || !Number.isInteger(order)) return { ok: false, error: 'Orden inválido' }
    value.sortOrder = order
  }
  return { ok: true, value }
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY.test(value)
}
