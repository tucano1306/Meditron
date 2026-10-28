// Modo empresa: tipos que viajan entre el servidor y las pantallas, y el
// cálculo de horas, overtime y pago de cada empleado. Sin Prisma.

import { computeOvertime } from './companies'

export type OrgRole = 'admin' | 'employee'
export type MemberStatus = 'pending' | 'active' | 'inactive'
export type CorrectionStatus = 'pending' | 'resolved' | 'rejected'

export interface OrgLocationInfo {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radiusMeters: number
}

export interface OrgSettings {
  id: string
  name: string
  weekStartsOn: number
  requireLocation: boolean
  overtimeAfterHours: number
  overtimeMultiplier: number
  breakMinutes: number
  breakAfterHours: number
  locations: OrgLocationInfo[]
}

export interface OrgMembership {
  memberId: string
  role: OrgRole
  status: MemberStatus
  org: OrgSettings
  /** Solo para administradores */
  joinCode?: string
}

export interface OrgShiftInfo {
  id: string
  memberId: string
  /** ISO */
  clockIn: string
  clockOut: string | null
  /** YYYY-MM-DD (Florida) */
  date: string
  breakSeconds: number
  inDistance: number | null
  outDistance: number | null
  inAccuracy: number | null
  outAccuracy: number | null
  inLatitude: number | null
  inLongitude: number | null
  outLatitude: number | null
  outLongitude: number | null
  source: 'clock' | 'admin'
  correctionNote: string | null
  correctionStatus: CorrectionStatus | null
  adminNote: string | null
  /** Lo cambió un administrador alguna vez */
  edited: boolean
}

export interface MemberInfo {
  id: string
  userId: string
  name: string
  email: string
  role: OrgRole
  status: MemberStatus
  hourlyRate: number
}

/** Segundos pagados de un turno terminado (sin el break) */
export function paidSeconds(shift: Pick<OrgShiftInfo, 'clockIn' | 'clockOut' | 'breakSeconds'>): number {
  if (!shift.clockOut) return 0
  const raw = Math.floor((new Date(shift.clockOut).getTime() - new Date(shift.clockIn).getTime()) / 1000)
  return Math.max(0, raw - shift.breakSeconds)
}

export interface MemberWeek {
  member: MemberInfo
  shifts: OrgShiftInfo[]
  totalSeconds: number
  regularSeconds: number
  overtimeSeconds: number
  regularPay: number
  overtimePay: number
  totalPay: number
  /** Turno sin salida marcada */
  openShift: OrgShiftInfo | null
  pendingCorrections: number
}

/** Horas, overtime y pago de un empleado en una semana de pago */
export function summarizeMemberWeek(member: MemberInfo, shifts: OrgShiftInfo[], org: Pick<OrgSettings, 'overtimeAfterHours' | 'overtimeMultiplier'>): MemberWeek {
  const closed = shifts.filter(s => s.clockOut)
  const ot = computeOvertime(
    closed.map(s => ({ id: s.id, startTime: s.clockIn, duration: paidSeconds(s) })),
    { baseRate: member.hourlyRate, thresholdHours: org.overtimeAfterHours, multiplier: org.overtimeMultiplier },
  )
  return {
    member,
    shifts,
    totalSeconds: ot.totalSeconds,
    regularSeconds: ot.regularSeconds,
    overtimeSeconds: ot.overtimeSeconds,
    regularPay: ot.regularPay,
    overtimePay: ot.overtimePay,
    totalPay: ot.totalPay,
    openShift: shifts.find(s => !s.clockOut) ?? null,
    pendingCorrections: shifts.filter(s => s.correctionStatus === 'pending').length,
  }
}

/** Un turno abierto por más de esto probablemente olvidó marcar la salida */
export const FORGOTTEN_SHIFT_HOURS = 14
