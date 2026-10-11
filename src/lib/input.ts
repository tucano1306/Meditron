// Validación de los datos que llegan a las APIs: tipos, largos y rangos.
// Nada llega a la base de datos sin pasar por aquí o por un validador propio
// (company-input, payment-store).

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

/** "El vehículo" → "Revisa el vehículo" (sirve para cualquier género) */
export function invalid(label: string): string {
  return `Revisa ${label.charAt(0).toLowerCase()}${label.slice(1)}`
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/

export const MAX_MONEY = 1_000_000

/** Largos máximos de los textos libres de un trabajo */
export const TEXT_LIMITS = {
  jobNumber: 50,
  vehicle: 50,
  serviceType: 60,
  observation: 1000,
  correctionNote: 500,
} as const

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

/**
 * Texto opcional: undefined = no viene (no se toca), null o vacío = borrarlo.
 * Rechaza lo que no sea texto (objetos, listas) y lo que pase del largo.
 */
export function optionalText(value: unknown, label: string, max: number): Result<string | null | undefined> {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null) return { ok: true, value: null }
  // Un número de trabajo puede llegar como número
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(value) : value
  if (typeof raw !== 'string') return { ok: false, error: invalid(label) }
  const trimmed = raw.trim()
  if (trimmed.length > max) return { ok: false, error: `${label}: máximo ${max} caracteres` }
  return { ok: true, value: trimmed || null }
}

/** Monto opcional en dólares (0 a MAX_MONEY); acepta número o texto numérico */
export function optionalMoney(value: unknown, label: string): Result<number | null | undefined> {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null || value === '') return { ok: true, value: null }
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > MAX_MONEY) return { ok: false, error: invalid(label) }
  return { ok: true, value: Math.round(n * 100) / 100 }
}

/** Entero dentro de un rango (acepta número o texto numérico) */
export function intInRange(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : null
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

/** Correo en minúsculas y sin espacios, o null si no es válido */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}

export function passwordError(value: unknown): string | null {
  if (typeof value !== 'string') return 'Contraseña inválida'
  if (value.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`
  if (value.length > PASSWORD_MAX) return `La contraseña puede tener hasta ${PASSWORD_MAX} caracteres`
  return null
}

/**
 * Campos de texto de un trabajo por hora (número, vehículo, servicio, nota).
 * Solo devuelve los que vienen en el body.
 */
export function parseEntryTexts(body: Record<string, unknown>): Result<{
  jobNumber?: string | null
  vehicle?: string | null
  serviceType?: string | null
  observation?: string | null
}> {
  const fields = [
    ['jobNumber', 'El número de trabajo'],
    ['vehicle', 'El vehículo'],
    ['serviceType', 'El tipo de servicio'],
    ['observation', 'La nota'],
  ] as const
  const value: Record<string, string | null> = {}
  for (const [key, label] of fields) {
    const parsed = optionalText(body[key], label, TEXT_LIMITS[key])
    if (!parsed.ok) return parsed
    if (parsed.value !== undefined) value[key] = parsed.value
  }
  return { ok: true, value }
}
