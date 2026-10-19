import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth-utils'
import { getUserCompany } from '@/lib/company-store'
import { applyCompanyBreak } from '@/lib/breaks'
import { breakRuleOf } from '@/lib/companies'
import { isDateKey } from '@/lib/input'
import { getFloridaDateString } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

// POST - Pone (según el break de la compañía) o quita el break de los turnos ya
// registrados desde una fecha. Body: from (YYYY-MM-DD), apply (true = poner)
export async function POST(request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response
    const userId = authResult.user.id

    const { id } = await context.params
    const company = await getUserCompany(userId, id)
    if (!company) return NextResponse.json({ success: false, error: 'Compañía no encontrada' }, { status: 404 })

    const body = await request.json()
    if (!isDateKey(body.from) || body.from > getFloridaDateString()) {
      return NextResponse.json({ success: false, error: 'Elige una fecha válida' }, { status: 400 })
    }
    if (typeof body.apply !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    if (body.apply && !breakRuleOf(company)) {
      return NextResponse.json({ success: false, error: 'Primero activa y guarda el break de la compañía' }, { status: 400 })
    }

    const changed = await applyCompanyBreak(userId, company, body.from, body.apply)
    return NextResponse.json({ success: true, data: { changed } })
  } catch (error) {
    console.error('Error applying company break:', error)
    return NextResponse.json({ success: false, error: 'Error al aplicar el break' }, { status: 500 })
  }
}
