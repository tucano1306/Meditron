import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { parseJobInput, serializeJob, withDerivedFields } from '@/lib/payment-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

async function findOwnJob(userId: string, id: string) {
  return prisma.paymentEntry.findFirst({ where: { id, userId, completed: true } })
}

// PATCH - Editar un trabajo terminado (solo los campos que vienen)
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response

    const { id } = await context.params
    const current = await findOwnJob(authResult.user.id, id)
    if (!current) return NextResponse.json({ success: false, error: 'Trabajo no encontrado' }, { status: 404 })

    const parsed = parseJobInput(await request.json(), true)
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })

    const row = await prisma.paymentEntry.update({ where: { id }, data: withDerivedFields(parsed.value, current) })
    return NextResponse.json({ success: true, data: serializeJob(row) })
  } catch (error) {
    console.error('Error updating payment job:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar el trabajo' }, { status: 500 })
  }
}

// DELETE - Eliminar un trabajo terminado
export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const authResult = await validateSession()
    if (!authResult.success) return authResult.response

    const { id } = await context.params
    const current = await findOwnJob(authResult.user.id, id)
    if (!current) return NextResponse.json({ success: false, error: 'Trabajo no encontrado' }, { status: 404 })

    await prisma.paymentEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting payment job:', error)
    return NextResponse.json({ success: false, error: 'Error al eliminar el trabajo' }, { status: 500 })
  }
}
