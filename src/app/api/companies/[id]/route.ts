import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getUserCompanies, getUserCompany } from '@/lib/company-store'
import { parseCompanyInput } from '@/lib/company-input'
import { recalculateAfterCompanyChange } from '@/lib/pay-periods'
import { FIRST_RULE_DATE } from '@/lib/companies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

// PATCH - Editar nombre, color, semana de pago, datos que registra o archivar
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const { id } = await context.params
    const before = await getUserCompany(userId, id)
    if (!before) return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })

    const fields = parseCompanyInput(await request.json(), true)
    if (!fields.ok) return NextResponse.json({ success: false, error: fields.error }, { status: 400 })

    if (fields.value.archived === true && !before.archived) {
      const companies = await getUserCompanies(userId)
      if (companies.filter(c => !c.archived).length <= 1) {
        return NextResponse.json({ success: false, error: 'Debe quedar al menos una compañía activa' }, { status: 400 })
      }
      const running = await prisma.timeEntry.count({ where: { userId, companyId: id, endTime: null } })
      if (running > 0) {
        return NextResponse.json({ success: false, error: 'Detén el turno en curso de esta compañía antes de archivarla' }, { status: 400 })
      }
    }

    await prisma.company.update({ where: { id }, data: fields.value })
    const after = await getUserCompany(userId, id)
    if (after && after.weekStartsOn !== before.weekStartsOn) {
      // Cambian las semanas de pago: el overtime semanal se recalcula completo
      await recalculateAfterCompanyChange(userId, before, after, FIRST_RULE_DATE)
    }

    return NextResponse.json({ success: true, data: after })
  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar la compañía' }, { status: 500 })
  }
}

// DELETE - Borrar una compañía sin trabajos (si tiene trabajos se archiva)
export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const { id } = await context.params
    const company = await getUserCompany(userId, id)
    if (!company) return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })

    const entries = await prisma.timeEntry.count({ where: { userId, companyId: id } })
    if (entries > 0) {
      return NextResponse.json(
        { success: false, error: 'Esta compañía tiene trabajos registrados. Archívala para ocultarla sin perder su historial.' },
        { status: 409 }
      )
    }
    const companies = await getUserCompanies(userId)
    if (companies.filter(c => !c.archived && c.id !== id).length === 0) {
      return NextResponse.json({ success: false, error: 'Debe quedar al menos una compañía activa' }, { status: 400 })
    }

    await prisma.company.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting company:', error)
    return NextResponse.json({ success: false, error: 'Error al borrar la compañía' }, { status: 500 })
  }
}
