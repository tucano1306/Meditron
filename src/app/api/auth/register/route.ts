import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { normalizeEmail, optionalText, passwordError } from "@/lib/input"
import { clientIp, countHits, recordHit } from "@/lib/rate-limit"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Cuentas que se pueden crear desde una misma conexión por hora */
const MAX_SIGNUPS_PER_HOUR = 5

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const email = normalizeEmail(body.email)
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Escribe un correo válido" },
        { status: 400 }
      )
    }
    const badPassword = passwordError(body.password)
    if (badPassword) {
      return NextResponse.json({ success: false, error: badPassword }, { status: 400 })
    }
    const name = optionalText(body.name, "El nombre", 80)
    if (!name.ok) {
      return NextResponse.json({ success: false, error: name.error }, { status: 400 })
    }

    // Freno a la creación masiva de cuentas
    const limitKey = `signup:${clientIp(request.headers)}`
    if (await countHits(limitKey, 3600 * 1000) >= MAX_SIGNUPS_PER_HOUR) {
      return NextResponse.json(
        { success: false, error: "Demasiados registros desde esta conexión. Intenta más tarde." },
        { status: 429 }
      )
    }

    // Verificar si el usuario ya existe (sin importar mayúsculas)
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Este email ya está registrado" },
        { status: 400 }
      )
    }

    // Hash de la contraseña
    const hashedPassword = await hash(body.password as string, 12)

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name.value ?? null
      }
    })
    await recordHit(limitKey)

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json(
      { success: false, error: "Error al crear usuario" },
      { status: 500 }
    )
  }
}
