import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isRole, memberInclude, orgAccess, serializeMember } from '@/lib/org-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ orgId: string; memberId: string }> }

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

/** Siempre debe quedar al menos un administrador activo */
async function activeAdmins(orgId: string): Promise<number> {
  return prisma.orgMember.count({ where: { orgId, role: 'admin', status: 'active' } })
}

// PATCH - Aprobar, desactivar o reactivar a una persona, cambiar su rol o su
// tarifa. Body: status ('active' | 'inactive'), role, hourlyRate
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { orgId, memberId } = await context.params
    const access = await orgAccess(orgId, { admin: true })
    if (!access.ok) return access.response

    const member = await prisma.orgMember.findFirst({ where: { id: memberId, orgId } })
    if (!member) return bad('Persona no encontrada', 404)
    const body = await request.json()

    const data: { status?: string; role?: string; hourlyRate?: number } = {}
    if (body.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'inactive') return bad('Estado inválido')
      data.status = body.status
    }
    if (body.role !== undefined) {
      if (!isRole(body.role)) return bad('Rol inválido')
      data.role = body.role
    }
    if (body.hourlyRate !== undefined) {
      const rate = Number(body.hourlyRate)
      if (!Number.isFinite(rate) || rate < 0 || rate > 10000) return bad('Tarifa inválida')
      data.hourlyRate = Math.round(rate * 100) / 100
    }

    // No dejar a la empresa sin administrador
    const losesAdmin = member.role === 'admin' && member.status === 'active'
      && ((data.role && data.role !== 'admin') || (data.status && data.status !== 'active'))
    if (losesAdmin && await activeAdmins(orgId) <= 1) {
      return bad('Debe quedar al menos un administrador activo')
    }

    const updated = await prisma.orgMember.update({ where: { id: member.id }, data, include: memberInclude })
    return NextResponse.json({ success: true, data: serializeMember(updated) })
  } catch (error) {
    console.error('Error updating member:', error)
    return bad('Error al guardar', 500)
  }
}

// DELETE - Rechazar una solicitud para unirse (solo si sigue pendiente)
export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { orgId, memberId } = await context.params
    const access = await orgAccess(orgId, { admin: true })
    if (!access.ok) return access.response
    const { count } = await prisma.orgMember.deleteMany({ where: { id: memberId, orgId, status: 'pending' } })
    if (count === 0) return bad('Solo se pueden rechazar solicitudes pendientes', 404)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error rejecting member:', error)
    return bad('Error al rechazar la solicitud', 500)
  }
}
