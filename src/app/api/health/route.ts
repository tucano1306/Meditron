import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    database: false,
    databaseError: null as string | null,
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasAuthSecret: !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
      nodeEnv: process.env.NODE_ENV
    }
  }

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch (error) {
    checks.databaseError = error instanceof Error ? error.message : 'Unknown error'
  }

  return NextResponse.json(checks)
}
