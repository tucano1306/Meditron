import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { orgAccess, recordEdit, serializeShift, shiftInclude, shiftSnapshot } from '@/lib/org-server'
import { breakRuleOf, breakToDeduct, dateKeyToUTC } from '@/lib/companies'
import { parseBreakMinutes, parseReason, parseShiftTimes } from '@/lib/org-shift-input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ orgId: string }> }

// POST - El administrador agrega un turno (p. ej. el empleado no pudo marcar).
// Body: memberId, date, start, end (vacío = sigue trabajando), breakMinutes, reason
export async function POST(request: NextRequest, context: Context) {
  try {
    const { orgId } = await context.params
    const access = await orgAccess(orgId, { admin: true })
    if (!access.ok) return access.response
    const { org, user } = access
    const body = await request.json()

    const member = typeof body.memberId === 'string'
      ? await prisma.orgMember.findFirst({ where: { id: body.memberId, orgId, status: { in: ['active', 'inactive'] } } })
      : null
    if (!member) return NextResponse.json({ success: false, error: 'Empleado no encontrado' }, { status: 404 })

    const times = parseShiftTimes(body)
    if (!times.ok) return NextResponse.json({ success: false, error: times.error }, { status: 400 })
    const reason = parseReason(body.reason)
    if (!reason.ok) return NextResponse.json({ success: false, error: reason.error }, { status: 400 })
    const breakMinutes = parseBreakMinutes(body.breakMinutes)
    if (!breakMinutes.ok) return NextResponse.json({ success: false, error: breakMinutes.error }, { status: 400 })

    const { clockIn, clockOut, date } = times.value
    if (!clockOut) {
      const open = await prisma.orgShift.findFirst({ where: { memberId: member.id, clockOut: null, deletedAt: null } })
      if (open) return NextResponse.json({ success: false, error: 'Ese empleado ya tiene un turno abierto' }, { status: 409 })
    }
    const seconds = clockOut ? Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000) : 0
    const breakSeconds = breakMinutes.value === undefined
      ? (clockOut ? breakToDeduct(breakRuleOf(org), seconds, seconds) : 0)
      : Math.min(breakMinutes.value * 60, Math.max(0, seconds - 60))

    const shift = await prisma.$transaction(async tx => {
      const created = await tx.orgShift.create({
        data: { orgId, memberId: member.id, clockIn, clockOut, date: dateKeyToUTC(date), breakSeconds, source: 'admin' },
      })
      await recordEdit(tx, { shiftId: created.id, editorId: user.id, action: 'create', reason: reason.value, after: shiftSnapshot(created) })
      return tx.orgShift.findUniqueOrThrow({ where: { id: created.id }, include: shiftInclude })
    })
    return NextResponse.json({ success: true, data: serializeShift(shift) })
  } catch (error) {
    console.error('Error creating shift:', error)
    return NextResponse.json({ success: false, error: 'Error al agregar el turno' }, { status: 500 })
  }
}
