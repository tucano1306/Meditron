import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Clientes usados antes (los más frecuentes primero), para sugerirlos al escribir
export async function GET() {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response

    const groups = await prisma.paymentEntry.groupBy({
      by: ['client'],
      where: { userId: authResult.user.id, client: { not: null } },
      _count: { client: true },
      orderBy: { _count: { client: 'desc' } },
      take: 30,
    })
    return NextResponse.json({ success: true, data: groups.map(g => g.client).filter(Boolean) })
  } catch (error) {
    console.error('Error listing payment clients:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener los clientes' }, { status: 500 })
  }
}
