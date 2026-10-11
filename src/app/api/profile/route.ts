import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { cleanProfileText, MAX_PROFILE_FIELD } from '@/lib/report-identity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH - Nombre completo y empresa con que la persona aparece en sus reportes.
// Body: name (obligatorio) y businessName (opcional; vacío lo quita).
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response

    const body = await request.json()
    if (typeof body.name !== 'string' || (body.businessName != null && typeof body.businessName !== 'string')) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }
    const name = cleanProfileText(body.name)
    const businessName = cleanProfileText(body.businessName ?? '') || null
    if (!name) {
      return NextResponse.json({ success: false, error: 'Escribe tu nombre' }, { status: 400 })
    }
    if (name.length > MAX_PROFILE_FIELD || (businessName?.length ?? 0) > MAX_PROFILE_FIELD) {
      return NextResponse.json({ success: false, error: `Máximo ${MAX_PROFILE_FIELD} letras` }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: authResult.user.id },
      data: { name, businessName },
      select: { name: true, businessName: true },
    })
    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar tu nombre' }, { status: 500 })
  }
}
