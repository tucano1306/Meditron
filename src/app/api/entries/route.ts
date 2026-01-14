import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Obtener entradas de tiempo
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekId = searchParams.get('weekId')
    const date = searchParams.get('date')

    const where: Record<string, unknown> = {}

    if (weekId) {
      where.weekId = weekId
    }

    if (date) {
      where.date = new Date(date)
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        week: true
      },
      orderBy: {
        startTime: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: entries
    })
  } catch (error) {
    console.error('Error getting entries:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener entradas' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar entrada
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      )
    }

    await prisma.timeEntry.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      data: { message: 'Entrada eliminada' }
    })
  } catch (error) {
    console.error('Error deleting entry:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar entrada' },
      { status: 500 }
    )
  }
}
