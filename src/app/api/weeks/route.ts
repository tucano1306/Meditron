import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Obtener semanas
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    const where: Record<string, unknown> = { userId }

    if (year) {
      where.year = Number.parseInt(year, 10)
    }

    if (month) {
      where.month = Number.parseInt(month, 10)
    }

    const weeks = await prisma.week.findMany({
      where,
      include: {
        entries: {
          orderBy: {
            startTime: 'desc'
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { weekNumber: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: weeks
    })
  } catch (error) {
    console.error('Error getting weeks:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener semanas' },
      { status: 500 }
    )
  }
}
