import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  checkClockLocation,
  floridaDateKey,
  orgAccess,
  orgWeek,
  serializeMember,
  serializeShift,
  shiftInclude,
} from '@/lib/org-server'
import { breakRuleOf, breakToDeduct, dateKeyToUTC, addDaysToKey } from '@/lib/companies'
import { isDateKey } from '@/lib/input'
import { summarizeMemberWeek } from '@/lib/org-shared'
import { formatTime12 } from '@/lib/report-format'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ orgId: string }> }

// GET - Estado del empleado: turno abierto y sus turnos de la semana (?week=
// cualquier día de la semana; por defecto la actual). Solo lectura.
export async function GET(request: NextRequest, context: Context) {
  try {
    const { orgId } = await context.params
    const access = await orgAccess(orgId)
    if (!access.ok) return access.response
    const { org, member } = access

    const today = floridaDateKey(new Date())
    const param = new URL(request.url).searchParams.get('week')
    const week = orgWeek(org, isDateKey(param) ? param : today)

    const [open, shifts] = await Promise.all([
      prisma.orgShift.findFirst({ where: { memberId: member.id, clockOut: null, deletedAt: null }, include: shiftInclude }),
      prisma.orgShift.findMany({
        where: { memberId: member.id, deletedAt: null, date: { gte: dateKeyToUTC(week.start), lte: dateKeyToUTC(week.end) } },
        include: shiftInclude,
        orderBy: { clockIn: 'asc' },
      }),
    ])
    const summary = summarizeMemberWeek(serializeMember(member), shifts.map(serializeShift), org)
    return NextResponse.json({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        openShift: open ? serializeShift(open) : null,
        week: { start: week.start, end: week.end, isCurrent: week.start === orgWeek(org, today).start },
        previousWeek: addDaysToKey(week.start, -7),
        summary,
      },
    })
  } catch (error) {
    console.error('Error getting clock status:', error)
    return NextResponse.json({ success: false, error: 'Error al cargar tu turno' }, { status: 500 })
  }
}

// POST - Marcar entrada o salida. Body: action ('in' | 'out'), latitude,
// longitude, accuracy. La hora es la del servidor: el teléfono no la elige.
export async function POST(request: NextRequest, context: Context) {
  try {
    const { orgId } = await context.params
    const access = await orgAccess(orgId)
    if (!access.ok) return access.response
    const { org, member } = access

    const body = await request.json()
    if (body.action !== 'in' && body.action !== 'out') {
      return NextResponse.json({ success: false, error: 'Acción inválida' }, { status: 400 })
    }
    const location = checkClockLocation(org, body)
    if (!location.ok) return NextResponse.json({ success: false, error: location.error, code: 'LOCATION' }, { status: 403 })

    const now = new Date()
    const open = await prisma.orgShift.findFirst({ where: { memberId: member.id, clockOut: null, deletedAt: null } })

    if (body.action === 'in') {
      if (open) {
        return NextResponse.json({ success: false, error: `Ya marcaste la entrada a las ${formatTime12(open.clockIn)}` }, { status: 409 })
      }
      const shift = await prisma.orgShift.create({
        data: {
          orgId: org.id,
          memberId: member.id,
          clockIn: now,
          date: dateKeyToUTC(floridaDateKey(now)),
          inLatitude: location.value.latitude,
          inLongitude: location.value.longitude,
          inAccuracy: location.value.accuracy,
          inDistance: location.value.distance,
        },
        include: shiftInclude,
      })
      return NextResponse.json({ success: true, data: { shift: serializeShift(shift) } })
    }

    if (!open) {
      return NextResponse.json({ success: false, error: 'No has marcado la entrada' }, { status: 409 })
    }
    // Break sin pago de la empresa, según el largo del turno
    const seconds = Math.floor((now.getTime() - open.clockIn.getTime()) / 1000)
    const breakSeconds = breakToDeduct(breakRuleOf(org), seconds, seconds)
    const shift = await prisma.orgShift.update({
      where: { id: open.id },
      data: {
        clockOut: now,
        breakSeconds,
        outLatitude: location.value.latitude,
        outLongitude: location.value.longitude,
        outAccuracy: location.value.accuracy,
        outDistance: location.value.distance,
      },
      include: shiftInclude,
    })
    return NextResponse.json({ success: true, data: { shift: serializeShift(shift) } })
  } catch (error) {
    console.error('Error clocking in/out:', error)
    return NextResponse.json({ success: false, error: 'Error al marcar' }, { status: 500 })
  }
}
