import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getUserCompany } from '@/lib/company-store'
import { isDateKey, parseRuleInput } from '@/lib/company-input'
import { recalculateAfterCompanyChange } from '@/lib/pay-periods'
import { dateKeyToUTC } from '@/lib/companies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

// PUT - Guardar el esquema de pago vigente desde una fecha (crea o reemplaza
// esa versión) y recalcular los trabajos afectados
export async function PUT(request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const { id } = await context.params
    const before = await getUserCompany(userId, id)
    if (!before) return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })

    const body = await request.json()
    const effectiveFrom = isDateKey(body.effectiveFrom) ? body.effectiveFrom : ''
    const rule = parseRuleInput(body, effectiveFrom)
    if (!rule.ok) return NextResponse.json({ success: false, error: rule.error }, { status: 400 })

    const data = { ...rule.value, effectiveFrom: dateKeyToUTC(rule.value.effectiveFrom) }
    await prisma.companyPayRule.upsert({
      where: { companyId_effectiveFrom: { companyId: id, effectiveFrom: data.effectiveFrom } },
      update: data,
      create: { ...data, companyId: id },
    })

    const after = await getUserCompany(userId, id)
    if (after) await recalculateAfterCompanyChange(userId, before, after, rule.value.effectiveFrom)
    return NextResponse.json({ success: true, data: after })
  } catch (error) {
    console.error('Error saving pay rule:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar el esquema de pago' }, { status: 500 })
  }
}

// DELETE - Quitar una versión del esquema de pago (?ruleId=)
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const { id } = await context.params
    const before = await getUserCompany(userId, id)
    if (!before) return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })

    const ruleId = new URL(request.url).searchParams.get('ruleId')
    const rule = before.payRules.find(r => r.id === ruleId)
    if (!rule) return NextResponse.json({ success: false, error: 'Versión no encontrada' }, { status: 404 })
    if (before.payRules.length <= 1) {
      return NextResponse.json({ success: false, error: 'La compañía necesita al menos un esquema de pago' }, { status: 400 })
    }

    await prisma.companyPayRule.delete({ where: { id: rule.id } })
    const after = await getUserCompany(userId, id)
    if (after) await recalculateAfterCompanyChange(userId, before, after, rule.effectiveFrom)
    return NextResponse.json({ success: true, data: after })
  } catch (error) {
    console.error('Error deleting pay rule:', error)
    return NextResponse.json({ success: false, error: 'Error al borrar la versión' }, { status: 500 })
  }
}
