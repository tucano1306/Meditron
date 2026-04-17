import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH - Marcar/desmarcar corrección pendiente en una entrada
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) {
      return authResult.response
    }

    const userId = authResult.user.id
    const { entryId, correctionPending, correctionNote, correctionResolved } = await request.json()

    if (!entryId || typeof correctionPending !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'entryId y correctionPending son requeridos' },
        { status: 400 }
      )
    }

    // Verificar que la entrada pertenece al usuario
    const entry = await prisma.timeEntry.findFirst({
      where: { id: entryId, userId }
    })

    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entrada no encontrada' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {
      correctionPending,
      correctionNote: correctionPending ? (correctionNote ?? null) : null,
    }

    // Si se marca como corregido, guardar ese estado
    if (typeof correctionResolved === 'boolean') {
      updateData.correctionResolved = correctionResolved
    }

    const updated = await prisma.timeEntry.update({
      where: { id: entryId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating correction status:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar corrección' },
      { status: 500 }
    )
  }
}
