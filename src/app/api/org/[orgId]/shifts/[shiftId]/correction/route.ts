import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { orgAccess, serializeShift, shiftInclude } from '@/lib/org-server'
import { optionalText } from '@/lib/input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ orgId: string; shiftId: string }> }

// POST - El empleado pide corregir uno de sus turnos (no lo puede cambiar él).
// Body: note (qué está mal y cuál es la hora correcta)
export async function POST(request: NextRequest, context: Context) {
  try {
    const { orgId, shiftId } = await context.params
    const access = await orgAccess(orgId)
    if (!access.ok) return access.response

    const shift = await prisma.orgShift.findFirst({ where: { id: shiftId, memberId: access.member.id, deletedAt: null } })
    if (!shift) return NextResponse.json({ success: false, error: 'Turno no encontrado' }, { status: 404 })

    const note = optionalText((await request.json()).note, 'El pedido', 500)
    if (!note.ok) return NextResponse.json({ success: false, error: note.error }, { status: 400 })
    if (!note.value || note.value.length < 5) {
      return NextResponse.json({ success: false, error: 'Explica qué hay que corregir (por ejemplo, la hora correcta de salida)' }, { status: 400 })
    }
    const updated = await prisma.orgShift.update({
      where: { id: shift.id },
      data: { correctionNote: note.value, correctionStatus: 'pending', adminNote: null },
      include: shiftInclude,
    })
    return NextResponse.json({ success: true, data: serializeShift(updated) })
  } catch (error) {
    console.error('Error requesting correction:', error)
    return NextResponse.json({ success: false, error: 'Error al enviar el pedido' }, { status: 500 })
  }
}

// DELETE - El empleado retira su pedido mientras está pendiente
export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { orgId, shiftId } = await context.params
    const access = await orgAccess(orgId)
    if (!access.ok) return access.response
    const { count } = await prisma.orgShift.updateMany({
      where: { id: shiftId, memberId: access.member.id, correctionStatus: 'pending', deletedAt: null },
      data: { correctionNote: null, correctionStatus: null },
    })
    if (count === 0) return NextResponse.json({ success: false, error: 'No hay un pedido pendiente en ese turno' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cancelling correction:', error)
    return NextResponse.json({ success: false, error: 'Error al retirar el pedido' }, { status: 500 })
  }
}
