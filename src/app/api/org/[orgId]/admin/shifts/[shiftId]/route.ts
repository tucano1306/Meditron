import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { floridaDateKey, orgAccess, recordEdit, serializeShift, shiftInclude, shiftSnapshot } from '@/lib/org-server'
import { breakRuleOf, breakToDeduct, dateKeyToUTC } from '@/lib/companies'
import { optionalText } from '@/lib/input'
import { parseBreakMinutes, parseReason, parseShiftTimes } from '@/lib/org-shift-input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ orgId: string; shiftId: string }> }

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

async function findShift(orgId: string, shiftId: string) {
  return prisma.orgShift.findFirst({ where: { id: shiftId, orgId, deletedAt: null } })
}

// GET - Historial de cambios del turno: quién, cuándo, antes, después y por qué
export async function GET(_request: NextRequest, context: Context) {
  try {
    const { orgId, shiftId } = await context.params
    const access = await orgAccess(orgId, { admin: true })
    if (!access.ok) return access.response
    const shift = await prisma.orgShift.findFirst({ where: { id: shiftId, orgId } })
    if (!shift) return bad('Turno no encontrado', 404)

    const edits = await prisma.orgShiftEdit.findMany({ where: { shiftId }, orderBy: { createdAt: 'asc' } })
    const editors = await prisma.user.findMany({ where: { id: { in: [...new Set(edits.map(e => e.editorId))] } }, select: { id: true, name: true, email: true } })
    const nameOf = (id: string) => {
      const u = editors.find(e => e.id === id)
      return u ? u.name || u.email : 'Desconocido'
    }
    return NextResponse.json({
      success: true,
      data: edits.map(e => ({
        id: e.id, action: e.action, reason: e.reason, before: e.before, after: e.after,
        editor: nameOf(e.editorId), createdAt: e.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Error loading shift history:', error)
    return bad('Error al cargar el historial', 500)
  }
}

// PATCH - Corregir las horas (date, start, end, breakMinutes + reason) y/o
// responder el pedido de corrección del empleado (correction: 'resolved' | 'rejected', adminNote)
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { orgId, shiftId } = await context.params
    const access = await orgAccess(orgId, { admin: true })
    if (!access.ok) return access.response
    const { org, user } = access

    const shift = await findShift(orgId, shiftId)
    if (!shift) return bad('Turno no encontrado', 404)
    const body = await request.json()

    const changesTimes = body.start !== undefined || body.end !== undefined || body.date !== undefined || body.breakMinutes !== undefined
    const answersCorrection = body.correction !== undefined
    if (!changesTimes && !answersCorrection) return bad('No hay nada que cambiar')

    const adminNote = optionalText(body.adminNote, 'La respuesta', 300)
    if (!adminNote.ok) return bad(adminNote.error)
    if (answersCorrection) {
      if (body.correction !== 'resolved' && body.correction !== 'rejected') return bad('Respuesta inválida')
      if (shift.correctionStatus !== 'pending') return bad('Ese turno no tiene un pedido pendiente')
    }

    const data: Record<string, unknown> = {}
    if (changesTimes) {
      // Si solo cambia el break se conservan las horas actuales
      const times = body.start === undefined && body.date === undefined && body.end === undefined
        ? { ok: true as const, value: { clockIn: shift.clockIn, clockOut: shift.clockOut, date: floridaDateKey(shift.clockIn) } }
        : parseShiftTimes(body)
      if (!times.ok) return bad(times.error)
      if (shift.clockOut && !times.value.clockOut) return bad('Escribe la hora de salida')
      const breakMinutes = parseBreakMinutes(body.breakMinutes)
      if (!breakMinutes.ok) return bad(breakMinutes.error)

      const { clockIn, clockOut, date } = times.value
      const seconds = clockOut ? Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000) : 0
      let breakSeconds = shift.breakSeconds
      if (breakMinutes.value !== undefined) breakSeconds = breakMinutes.value * 60
      else if (clockOut && !shift.clockOut) breakSeconds = breakToDeduct(breakRuleOf(org), seconds, seconds)
      Object.assign(data, { clockIn, clockOut, date: dateKeyToUTC(date), breakSeconds: clockOut ? Math.min(breakSeconds, Math.max(0, seconds - 60)) : 0 })
    }
    if (answersCorrection) {
      data.correctionStatus = body.correction
      data.adminNote = adminNote.value ?? null
    }

    // Todo cambio de horas lleva motivo; responder un pedido usa la respuesta como motivo
    let reasonText: string
    if (changesTimes) {
      const reason = parseReason(body.reason ?? adminNote.value)
      if (!reason.ok) return bad(reason.error)
      reasonText = reason.value
    } else {
      reasonText = adminNote.value || (body.correction === 'resolved' ? 'Pedido de corrección resuelto' : 'Pedido de corrección rechazado')
    }

    const updated = await prisma.$transaction(async tx => {
      const after = await tx.orgShift.update({ where: { id: shift.id }, data })
      await recordEdit(tx, {
        shiftId: shift.id,
        editorId: user.id,
        action: changesTimes ? 'update' : body.correction === 'resolved' ? 'resolve' : 'reject',
        reason: reasonText,
        before: shiftSnapshot(shift),
        after: shiftSnapshot(after),
      })
      return tx.orgShift.findUniqueOrThrow({ where: { id: shift.id }, include: shiftInclude })
    })
    return NextResponse.json({ success: true, data: serializeShift(updated) })
  } catch (error) {
    console.error('Error editing shift:', error)
    return bad('Error al guardar el turno', 500)
  }
}

// DELETE - Borra un turno (?reason=). Se conserva oculto para el historial
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { orgId, shiftId } = await context.params
    const access = await orgAccess(orgId, { admin: true })
    if (!access.ok) return access.response

    const shift = await findShift(orgId, shiftId)
    if (!shift) return bad('Turno no encontrado', 404)
    const reason = parseReason(new URL(request.url).searchParams.get('reason'))
    if (!reason.ok) return bad(reason.error)

    await prisma.$transaction(async tx => {
      await tx.orgShift.update({ where: { id: shift.id }, data: { deletedAt: new Date() } })
      await recordEdit(tx, { shiftId: shift.id, editorId: access.user.id, action: 'delete', reason: reason.value, before: shiftSnapshot(shift) })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting shift:', error)
    return bad('Error al borrar el turno', 500)
  }
}
