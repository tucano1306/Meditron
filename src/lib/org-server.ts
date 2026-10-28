// Servidor del modo empresa: quién puede hacer qué, la ubicación al marcar,
// el historial de cambios y la hoja de horas de cada semana.

import { randomInt } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from './prisma'
import { validateSession, type ValidatedUser } from './auth-utils'
import { addDaysToKey, dateKeyToUTC, getPayPeriod, toDateKey } from './companies'
import { getFloridaDateComponents } from './utils'
import { MAX_ACCURACY_METERS, formatDistance, isValidCoordinate, nearestPlace } from './geo'
import {
  summarizeMemberWeek,
  type CorrectionStatus,
  type MemberInfo,
  type MemberStatus,
  type OrgRole,
  type OrgSettings,
  type OrgShiftInfo,
} from './org-shared'

export const orgInclude = {
  locations: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrganizationInclude

type DbOrg = Prisma.OrganizationGetPayload<{ include: typeof orgInclude }>
type DbMember = Prisma.OrgMemberGetPayload<{ include: { user: { select: { id: true; name: true; email: true } } } }>
type DbShift = Prisma.OrgShiftGetPayload<{ include: { _count: { select: { edits: true } } } }>

export const shiftInclude = { _count: { select: { edits: true } } } satisfies Prisma.OrgShiftInclude
export const memberInclude = { user: { select: { id: true, name: true, email: true } } } satisfies Prisma.OrgMemberInclude

// ── Serialización ─────────────────────────────────────────────────────────────

export function serializeOrg(org: DbOrg): OrgSettings {
  return {
    id: org.id,
    name: org.name,
    weekStartsOn: org.weekStartsOn,
    requireLocation: org.requireLocation,
    overtimeAfterHours: org.overtimeAfterHours,
    overtimeMultiplier: org.overtimeMultiplier,
    breakMinutes: org.breakMinutes,
    breakAfterHours: org.breakAfterHours,
    locations: org.locations.map(l => ({
      id: l.id, name: l.name, address: l.address,
      latitude: l.latitude, longitude: l.longitude, radiusMeters: l.radiusMeters,
    })),
  }
}

export function serializeMember(m: DbMember): MemberInfo {
  return {
    id: m.id,
    userId: m.user.id,
    name: m.user.name || m.user.email.split('@')[0],
    email: m.user.email,
    role: m.role === 'admin' ? 'admin' : 'employee',
    status: (['pending', 'active', 'inactive'].includes(m.status) ? m.status : 'pending') as MemberStatus,
    hourlyRate: m.hourlyRate,
  }
}

export function serializeShift(s: DbShift): OrgShiftInfo {
  return {
    id: s.id,
    memberId: s.memberId,
    clockIn: s.clockIn.toISOString(),
    clockOut: s.clockOut?.toISOString() ?? null,
    date: toDateKey(s.date),
    breakSeconds: s.breakSeconds,
    inDistance: s.inDistance,
    outDistance: s.outDistance,
    inAccuracy: s.inAccuracy,
    outAccuracy: s.outAccuracy,
    inLatitude: s.inLatitude,
    inLongitude: s.inLongitude,
    outLatitude: s.outLatitude,
    outLongitude: s.outLongitude,
    source: s.source === 'admin' ? 'admin' : 'clock',
    correctionNote: s.correctionNote,
    correctionStatus: (s.correctionStatus as CorrectionStatus | null) ?? null,
    adminNote: s.adminNote,
    edited: s._count.edits > 0,
  }
}

/** Día de Florida (YYYY-MM-DD) de un instante */
export function floridaDateKey(date: Date): string {
  const { year, month, day } = getFloridaDateComponents(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ── Código para unirse ────────────────────────────────────────────────────────

/** Sin letras que se confunden (0/O, 1/I/L) */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function newJoinCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
}

export function normalizeJoinCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.toUpperCase().replaceAll(/[^A-Z0-9]/g, '')
  return code.length === 8 ? code : null
}

// ── Acceso ────────────────────────────────────────────────────────────────────

export type OrgAccess =
  | { ok: true; user: ValidatedUser; member: DbMember & { org: DbOrg }; org: DbOrg }
  | { ok: false; response: NextResponse }

function deny(error: string, status: number): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ success: false, error }, { status }) }
}

/**
 * Sesión válida + membresía activa en la empresa. Con `admin`, además debe ser
 * administrador. Quien no pertenece a la empresa recibe 404 (no se revela que existe).
 */
export async function orgAccess(orgId: string, { admin = false }: { admin?: boolean } = {}): Promise<OrgAccess> {
  const auth = await validateSession()
  if (!auth.success) return { ok: false, response: auth.response }
  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: auth.user.id } },
    include: { ...memberInclude, org: { include: orgInclude } },
  })
  if (!member) return deny('Empresa no encontrada', 404)
  if (member.status === 'pending') return deny('Tu solicitud para unirte todavía no ha sido aprobada', 403)
  if (member.status !== 'active') return deny('Tu acceso a esta empresa está desactivado', 403)
  if (admin && member.role !== 'admin') return deny('Solo un administrador puede hacer esto', 403)
  return { ok: true, user: auth.user, member, org: member.org }
}

export function isRole(value: unknown): value is OrgRole {
  return value === 'admin' || value === 'employee'
}

// ── Ubicación al marcar ───────────────────────────────────────────────────────

export interface ClockLocation {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  distance: number | null
}

/**
 * Revisa la ubicación enviada por el teléfono contra las oficinas. Si la
 * empresa la exige, debe venir, ser precisa y estar dentro del radio.
 */
export function checkClockLocation(org: DbOrg, body: Record<string, unknown>): { ok: true; value: ClockLocation } | { ok: false; error: string } {
  const lat = body.latitude
  const lng = body.longitude
  const accuracy = typeof body.accuracy === 'number' && Number.isFinite(body.accuracy) && body.accuracy >= 0 ? body.accuracy : null
  const hasCoords = isValidCoordinate(lat, lng)

  if (!hasCoords) {
    if (org.requireLocation) return { ok: false, error: 'Activa la ubicación del teléfono para marcar' }
    return { ok: true, value: { latitude: null, longitude: null, accuracy: null, distance: null } }
  }
  const nearest = nearestPlace(org.locations, lat as number, lng as number)
  const value: ClockLocation = { latitude: lat as number, longitude: lng as number, accuracy, distance: nearest ? Math.round(nearest.distance) : null }
  if (!org.requireLocation) return { ok: true, value }

  if (!nearest) return { ok: false, error: 'La empresa todavía no tiene la oficina configurada. Avísale al administrador.' }
  if (accuracy === null || accuracy > MAX_ACCURACY_METERS) {
    return { ok: false, error: `Tu ubicación es imprecisa${accuracy === null ? '' : ` (±${formatDistance(accuracy)})`}. Activa el GPS o sal al aire libre y vuelve a intentar.` }
  }
  if (nearest.distance > nearest.place.radiusMeters) {
    return {
      ok: false,
      error: `Estás a ${formatDistance(nearest.distance)} de ${nearest.place.name}. Para marcar debes estar a menos de ${formatDistance(nearest.place.radiusMeters)}.`,
    }
  }
  return { ok: true, value }
}

// ── Historial ─────────────────────────────────────────────────────────────────

export function shiftSnapshot(s: { clockIn: Date; clockOut: Date | null; breakSeconds: number }): Prisma.InputJsonObject {
  return { clockIn: s.clockIn.toISOString(), clockOut: s.clockOut?.toISOString() ?? null, breakSeconds: s.breakSeconds }
}

export async function recordEdit(
  tx: Prisma.TransactionClient,
  edit: { shiftId: string; editorId: string; action: string; reason: string; before?: Prisma.InputJsonObject | null; after?: Prisma.InputJsonObject | null },
) {
  await tx.orgShiftEdit.create({
    data: {
      shiftId: edit.shiftId,
      editorId: edit.editorId,
      action: edit.action,
      reason: edit.reason,
      before: edit.before ?? undefined,
      after: edit.after ?? undefined,
    },
  })
}

// ── Hoja de horas ─────────────────────────────────────────────────────────────

/** Semana de pago de la empresa que contiene ese día */
export function orgWeek(org: Pick<DbOrg, 'weekStartsOn'>, dateKey: string) {
  return getPayPeriod(dateKey, org.weekStartsOn)
}

/** Horas, overtime y pago de cada empleado en una semana de pago */
export async function buildTimesheet(org: DbOrg, weekStart: string) {
  const end = addDaysToKey(weekStart, 6)
  const [members, shifts] = await Promise.all([
    prisma.orgMember.findMany({
      where: { orgId: org.id, status: { in: ['active', 'inactive'] } },
      include: memberInclude,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.orgShift.findMany({
      where: { orgId: org.id, deletedAt: null, date: { gte: dateKeyToUTC(weekStart), lte: dateKeyToUTC(end) } },
      include: shiftInclude,
      orderBy: { clockIn: 'asc' },
    }),
  ])
  const byMember = new Map<string, OrgShiftInfo[]>()
  for (const shift of shifts.map(serializeShift)) {
    byMember.set(shift.memberId, [...(byMember.get(shift.memberId) ?? []), shift])
  }
  const weeks = members
    .map(m => summarizeMemberWeek(serializeMember(m), byMember.get(m.id) ?? [], org))
    // Los inactivos y los administradores que no marcan solo aparecen si trabajaron esa semana
    .filter(w => w.shifts.length > 0 || (w.member.status === 'active' && w.member.role === 'employee'))
  return {
    start: weekStart,
    end,
    members: weeks,
    totals: {
      seconds: weeks.reduce((sum, w) => sum + w.totalSeconds, 0),
      overtimeSeconds: weeks.reduce((sum, w) => sum + w.overtimeSeconds, 0),
      pay: weeks.reduce((sum, w) => sum + w.totalPay, 0),
    },
  }
}

// ── Dirección → coordenadas ───────────────────────────────────────────────────

/** Coordenadas de una dirección (OpenStreetMap). null si no se encuentra */
export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number; label: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Meditron time clock (meditron-liart.vercel.app)', 'Accept-Language': 'es,en' },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const results = await res.json() as { lat: string; lon: string; display_name: string }[]
  const first = results[0]
  if (!first) return null
  const latitude = Number(first.lat)
  const longitude = Number(first.lon)
  return isValidCoordinate(latitude, longitude) ? { latitude, longitude, label: first.display_name } : null
}
