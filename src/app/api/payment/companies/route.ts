import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { companyStats, parsePayCompanyInput, serializePayCompany } from '@/lib/pay-company-store'
import { MAX_PAY_COMPANIES } from '@/lib/pay-companies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Compañías del modo por pago (también las archivadas), con lo que falta por cobrar
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const [rows, stats] = await Promise.all([
      prisma.payCompany.findMany({ where: { userId }, orderBy: [{ archived: 'asc' }, { createdAt: 'asc' }] }),
      companyStats(userId),
    ])
    return NextResponse.json({ success: true, data: rows.map(row => serializePayCompany(row, stats.get(row.id))) })
  } catch (error) {
    console.error('Error listing pay companies:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener las compañías' }, { status: 500 })
  }
}

// POST - Nueva compañía: nombre, color, cómo paga (por día, por trabajo o variable) y cuánto
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const parsed = parsePayCompanyInput(await request.json(), false)
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })

    const count = await prisma.payCompany.count({ where: { userId } })
    if (count >= MAX_PAY_COMPANIES) {
      return NextResponse.json({ success: false, error: `Puedes tener hasta ${MAX_PAY_COMPANIES} compañías. Borra o reutiliza una que ya no uses.` }, { status: 400 })
    }

    const row = await prisma.payCompany.create({
      data: { ...(parsed.value as Prisma.PayCompanyUncheckedCreateInput), userId },
    })
    return NextResponse.json({ success: true, data: serializePayCompany(row) })
  } catch (error) {
    console.error('Error creating pay company:', error)
    return NextResponse.json({ success: false, error: 'Error al crear la compañía' }, { status: 500 })
  }
}
