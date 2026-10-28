import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { normalizeJoinCode } from '@/lib/org-server'
import { countHits, recordHit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Intentos de código por persona y hora: evita adivinar códigos */
const MAX_TRIES_PER_HOUR = 10

// POST - Pide unirse a una empresa con su código. Queda pendiente hasta que un
// administrador lo apruebe. Body: code
export async function POST(request: NextRequest) {
  try {
    const auth = await validateSession()
    if (!auth.success) return auth.response
    const userId = auth.user.id

    const key = `org-join:${userId}`
    if (await countHits(key, 3600 * 1000) >= MAX_TRIES_PER_HOUR) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Prueba de nuevo en una hora.' }, { status: 429 })
    }

    const code = normalizeJoinCode((await request.json()).code)
    const org = code ? await prisma.organization.findUnique({ where: { joinCode: code }, select: { id: true, name: true } }) : null
    if (!org) {
      await recordHit(key)
      return NextResponse.json({ success: false, error: 'Ese código no existe. Revísalo con tu administrador.' }, { status: 404 })
    }

    const existing = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId: org.id, userId } } })
    if (existing) {
      return NextResponse.json({ success: true, data: { orgName: org.name, status: existing.status, alreadyMember: true } })
    }
    await prisma.orgMember.create({ data: { orgId: org.id, userId, role: 'employee', status: 'pending' } })
    return NextResponse.json({ success: true, data: { orgName: org.name, status: 'pending', alreadyMember: false } })
  } catch (error) {
    console.error('Error joining organization:', error)
    return NextResponse.json({ success: false, error: 'Error al unirte a la empresa' }, { status: 500 })
  }
}
