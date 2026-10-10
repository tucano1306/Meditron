import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { getUserCompanies } from '@/lib/company-store'
import { parseCompanyInput, parseRuleInput } from '@/lib/company-input'
import { dateKeyToUTC, FIRST_RULE_DATE } from '@/lib/companies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Compañías del usuario con sus esquemas de pago
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response

    const companies = await getUserCompanies(authResult.user.id)
    return NextResponse.json({ success: true, data: companies })
  } catch (error) {
    console.error('Error getting companies:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener las compañías' }, { status: 500 })
  }
}

// POST - Crear una compañía con su esquema de pago
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const body = await request.json()
    const fields = parseCompanyInput(body, false)
    if (!fields.ok) return NextResponse.json({ success: false, error: fields.error }, { status: 400 })
    // La primera regla cubre todo el historial de la compañía
    const rule = parseRuleInput(body.rule ?? {}, FIRST_RULE_DATE)
    if (!rule.ok) return NextResponse.json({ success: false, error: rule.error }, { status: 400 })

    const existing = await getUserCompanies(userId)
    const company = await prisma.company.create({
      data: {
        ...fields.value,
        name: fields.value.name ?? '',
        archived: false,
        sortOrder: fields.value.sortOrder ?? Math.max(-1, ...existing.map(c => c.sortOrder)) + 1,
        userId,
        payRules: { create: { ...rule.value, effectiveFrom: dateKeyToUTC(rule.value.effectiveFrom) } },
      },
    })

    const companies = await getUserCompanies(userId)
    return NextResponse.json({ success: true, data: companies.find(c => c.id === company.id) })
  } catch (error) {
    console.error('Error creating company:', error)
    return NextResponse.json({ success: false, error: 'Error al crear la compañía' }, { status: 500 })
  }
}
