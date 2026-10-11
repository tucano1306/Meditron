import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - ¿Está viva la app y su base de datos? Es pública, así que no dice nada
// de la configuración ni de los errores (eso queda en los logs del servidor).
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, database: true, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({ ok: false, database: false, timestamp: new Date().toISOString() }, { status: 503 })
  }
}
